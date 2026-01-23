import { db } from '$lib/server/db';
import { Prisma } from '$prisma/generated/client';
import { DomainStatus } from '$prisma/generated/enums';
import { formatExpirationDate, formatExpiresIn } from '$lib/server/utils';
import { renderExpiringDomainEmail, renderCertificateChangedEmail } from '$lib/server/email-templates';
import { EmailOutboxPriorities } from '$lib/server/email';
import { createLogger } from '$lib/server/logger';
import { CertFetchError, type CertificateInfo, fetchCertificate } from '$lib/server/fetch-cert';
import { computeDomainStatus } from '$lib/server/status';
import { env } from '$env/dynamic/private';

export const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

// Domains to fetch at a time
const CONCURRENCY_LIMIT = 3;

type DomainWithUser = Prisma.DomainGetPayload<{ include: { user: true } }>;
type ExpirationStatus = Exclude<DomainStatus, 'PENDING' | 'OK'>;

const EXPIRATION_EMAIL_METADATA: Record<
	ExpirationStatus,
	{ isCritical: boolean; subject: string }
> = {
	[DomainStatus.EXPIRING_30DAYS]: {
		isCritical: false,
		subject: 'Certificate expiring in 30 days'
	},
	[DomainStatus.EXPIRING_14DAYS]: {
		isCritical: false,
		subject: 'Certificate expiring in 14 days'
	},
	[DomainStatus.EXPIRING_7DAYS]: {
		isCritical: true,
		subject: 'Certificate expiring in 7 days'
	},
	[DomainStatus.EXPIRING_1DAY]: {
		isCritical: true,
		subject: 'Certificate expiring in 1 day'
	},
	[DomainStatus.EXPIRED]: {
		isCritical: true,
		subject: 'Certificate expired'
	}
};

const NOTIFY_STATUSES = new Set<DomainStatus>([
	DomainStatus.EXPIRING_30DAYS,
	DomainStatus.EXPIRING_14DAYS,
	DomainStatus.EXPIRING_7DAYS,
	DomainStatus.EXPIRING_1DAY,
	DomainStatus.EXPIRED
]);

const logger = createLogger('worker-checks');

export async function runChecks() {
	const now = new Date();
	const staleBefore = new Date(now.getTime() - CHECK_STALE_THRESHOLD_MS);
	const domains = await db.domain.findMany({
		where: {
			confirmed: true,
			user: { confirmed: true },
			OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleBefore } }]
		},
		include: { user: true }
	});

	logger.info(`Found ${domains.length} domains to process`);

	for (let index = 0; index < domains.length; index += CONCURRENCY_LIMIT) {
		const chunk = domains.slice(index, index + CONCURRENCY_LIMIT);
		await Promise.all(chunk.map((domain) => checkDomain(domain, now)));
	}
}

async function checkDomain(domain: DomainWithUser, now: Date) {
	const port = domain.port ?? 443;
	let cert: CertificateInfo;

	try {
		cert = await fetchCertificate(domain.name, port);
	} catch (error) {
		let dbErrorMessage: string;
		if (error instanceof CertFetchError) {
			dbErrorMessage = error.message;
			logger.warn(error, `[${domain.name}] Check failed: ${dbErrorMessage}`);
		} else {
			dbErrorMessage = 'Unknown error';
			logger.error(
				error,
				`[${domain.name}] Unknown error while fetching certificate for domain, continuing`
			);
		}

		await db.$transaction([
			db.check.create({
				data: {
					domainId: domain.id,
					error: dbErrorMessage
				}
			}),
			db.domain.update({
				where: { id: domain.id },
				data: {
					lastCheckedAt: now,
					error: dbErrorMessage,
					errorStartedAt: domain.errorStartedAt ?? now
				}
			})
		]);
		return;
	}

	// Detect certificate change
	const certChanged =
		domain.fingerprint !== null && domain.fingerprint !== cert.fingerprint256;

	if (certChanged) {
		logger.info(`[${domain.name}] Certificate changed detected`);
		await queueCertificateChangedEmail(
			domain.user.email,
			domain.name,
			{
				notBefore: domain.notBefore,
				notAfter: domain.notAfter,
				issuer: domain.issuer,
				cn: domain.cn,
				serial: domain.serial
			},
			{
				notBefore: cert.notBefore,
				notAfter: cert.notAfter,
				issuer: cert.issuer,
				cn: cert.cn,
				serial: cert.serial
			},
			domain.user.settingsToken
		);
	}

	const nextStatus = computeDomainStatus(cert.notAfter, now);
	const shouldNotify = nextStatus !== domain.status && NOTIFY_STATUSES.has(nextStatus);
	logger.info(`[${domain.name}] Status: ${nextStatus}`);

	if (shouldNotify) {
		const daysRemaining = Math.ceil((cert.notAfter.getTime() - now.getTime()) / 86_400_000);
		logger.info(
			`[${domain.name}] Sending notification for new status: ${nextStatus} (${daysRemaining} days remaining)`
		);
		await queueExpiringDomainEmail(
			domain.user.email,
			nextStatus as ExpirationStatus,
			domain.name,
			cert.notAfter,
			cert.issuer,
			domain.user.settingsToken
		);
	}

	await db.$transaction([
		db.check.create({
			data: {
				domainId: domain.id,
				notBefore: cert.notBefore,
				notAfter: cert.notAfter,
				issuer: cert.issuer,
				cn: cert.cn,
				san: cert.san,
				serial: cert.serial,
				fingerprint: cert.fingerprint256,
				ip: cert.ip
			}
		}),
		db.domain.update({
			where: { id: domain.id },
			data: {
				lastCheckedAt: now,
				status: nextStatus,
				notBefore: cert.notBefore,
				notAfter: cert.notAfter,
				issuer: cert.issuer,
				cn: cert.cn,
				san: cert.san,
				serial: cert.serial,
				fingerprint: cert.fingerprint256,
				ip: cert.ip,
				error: null,
				errorStartedAt: null,
				lastNotifiedAt: shouldNotify ? now : domain.lastNotifiedAt,
				lastCertChangeNotifiedAt: certChanged ? now : domain.lastCertChangeNotifiedAt
			}
		})
	]);
}

async function queueExpiringDomainEmail(
	to: string,
	status: ExpirationStatus,
	domain: string,
	notAfter: Date,
	issuer: string | null,
	settingsToken: string
) {
	const metadata = EXPIRATION_EMAIL_METADATA[status];
	const settingsUrl = `${env.WEBSITE_URL}/?token=${settingsToken}`;
	const daysRemaining = Math.ceil((notAfter.getTime() - Date.now()) / 86_400_000);

	const html = renderExpiringDomainEmail({
		domain,
		expiresIn: formatExpiresIn(daysRemaining, status),
		expiresDate: formatExpirationDate(notAfter),
		issuer: issuer ?? 'Unknown',
		settingsUrl,
		isCritical: metadata.isCritical,
		isExpired: status === DomainStatus.EXPIRED
	});

	await db.emailOutbox.create({
		data: {
			recipients: [to],
			subject: `${metadata.subject}: ${domain}`,
			body: html,
			templateName: 'Expiring',
			priority: EmailOutboxPriorities.Medium
		}
	});
}

async function queueCertificateChangedEmail(
	to: string,
	domain: string,
	oldCert: {
		notBefore: Date | null;
		notAfter: Date | null;
		issuer: string | null;
		cn: string | null;
		serial: string | null;
	},
	newCert: {
		notBefore: Date;
		notAfter: Date;
		issuer: string | null;
		cn: string | null;
		serial: string | null;
	},
	settingsToken: string
) {
	const settingsUrl = `${env.WEBSITE_URL}/?token=${settingsToken}`;

	const html = renderCertificateChangedEmail({
		domain,
		firstDetectedDate: formatExpirationDate(new Date()),
		oldCert: {
			domain: oldCert.cn || domain,
			issuer: oldCert.issuer || 'Unknown',
			validFrom: formatExpirationDate(oldCert.notBefore!),
			validUntil: formatExpirationDate(oldCert.notAfter!),
			serial: oldCert.serial
		},
		newCert: {
			domain: newCert.cn || domain,
			issuer: newCert.issuer || 'Unknown',
			validFrom: formatExpirationDate(newCert.notBefore),
			validUntil: formatExpirationDate(newCert.notAfter),
			serial: newCert.serial
		},
		settingsUrl
	});

	await db.emailOutbox.create({
		data: {
			recipients: [to],
			subject: `Certificate changed: ${domain}`,
			body: html,
			templateName: 'CertificateChanged',
			priority: EmailOutboxPriorities.Medium
		}
	});
}
