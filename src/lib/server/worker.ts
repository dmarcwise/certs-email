import { DomainStatus, type EmailOutbox, Prisma } from '$prisma/generated/client';
import { db } from './db';
import { CertFetchError, type CertificateInfo, fetchCertificate } from './fetch-cert';
import { computeDomainStatus } from './status';
import { sendQueuedEmail, EmailOutboxPriorities } from './email';
import { createLogger } from './logger';
import { formatExpirationDate, formatExpiresIn } from '$lib/server/utils';
import { renderExpiringDomainEmail, renderHeartbeatEmail } from '$lib/server/email-templates';
import { env } from '$env/dynamic/private';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HEARTBEAT_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const EMAIL_OUTBOX_POLL_INTERVAL_MS = 10_000;
const EMAIL_OUTBOX_BATCH_SIZE = 10;
const EMAIL_OUTBOX_MAX_ATTEMPTS = 15;
const EMAIL_OUTBOX_INITIAL_DELAY_MS = 10_000;
const EMAIL_OUTBOX_MAX_DELAY_MS = 20 * 60 * 1000;

// Domains to fetch at a time
const CONCURRENCY_LIMIT = 3;

const NOTIFY_STATUSES = new Set<DomainStatus>([
	DomainStatus.EXPIRING_30DAYS,
	DomainStatus.EXPIRING_14DAYS,
	DomainStatus.EXPIRING_7DAYS,
	DomainStatus.EXPIRING_1DAY,
	DomainStatus.EXPIRED
]);

const logger = createLogger('worker');

type DomainWithUser = Prisma.DomainGetPayload<{ include: { user: true } }>;
type ExpirationStatus = Exclude<DomainStatus, 'PENDING' | 'OK'>;

const EXPIRATION_EMAIL_METADATA: Record<
	ExpirationStatus,
	{ label: string; className: string; subject: string }
> = {
	[DomainStatus.EXPIRING_30DAYS]: {
		label: 'EXPIRING IN 30 DAYS',
		className: 'warning',
		subject: 'Certificate expiring in 30 days'
	},
	[DomainStatus.EXPIRING_14DAYS]: {
		label: 'EXPIRING IN 14 DAYS',
		className: 'warning',
		subject: 'Certificate expiring in 14 days'
	},
	[DomainStatus.EXPIRING_7DAYS]: {
		label: 'EXPIRING IN 7 DAYS',
		className: 'critical',
		subject: 'Certificate expiring in 7 days'
	},
	[DomainStatus.EXPIRING_1DAY]: {
		label: 'EXPIRING IN 1 DAY',
		className: 'critical',
		subject: 'Certificate expiring in 1 day'
	},
	[DomainStatus.EXPIRED]: {
		label: 'EXPIRED',
		className: 'critical',
		subject: 'Certificate expired'
	}
};

export function startWorker() {
	logger.info('Starting background tasks');

	scheduleLoop(
		runChecks,
		CHECK_INTERVAL_MS,
		() => logger.info('Starting domain checks run...'),
		() => logger.info('Domain checks finished'),
		(err) => logger.error(err, 'Domain checks run failed')
	);

	scheduleLoop(
		runHeartbeat,
		HEARTBEAT_INTERVAL_MS,
		() => logger.info('Starting heartbeat report run...'),
		() => logger.info('Heartbeat report finished'),
		(err) => logger.error(err, 'Heartbeat report run failed')
	);

	scheduleLoop(
		runEmailOutbox,
		EMAIL_OUTBOX_POLL_INTERVAL_MS,
		() => logger.debug('Checking email outbox...'),
		() => logger.debug('Email outbox poll finished'),
		(err) => logger.error(err, 'Email outbox poll failed')
	);
}

function scheduleLoop(
	task: () => Promise<void>,
	intervalMs: number,
	onRunStart: () => void = () => {},
	onRunFinish: () => void = () => {},
	onRunFail: (error: Error) => void = () => {}
) {
	let running = false;

	const run = async () => {
		if (running) return;
		running = true;

		try {
			onRunStart();
			await task();
			onRunFinish();
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			onRunFail(err);
		} finally {
			running = false;
			setTimeout(run, intervalMs);
		}
	};

	setTimeout(run, 0);
}

async function runEmailOutbox() {
	const jobs = await db.emailOutbox.findMany({
		where: {
			status: 'Pending',
			AND: [
				{
					OR: [{ sendAfter: null }, { sendAfter: { lte: new Date() } }]
				},
				{
					OR: [{ retryAfter: null }, { retryAfter: { lte: new Date() } }]
				}
			]
		},
		orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
		take: EMAIL_OUTBOX_BATCH_SIZE
	});

	if (jobs.length === 0) {
		return;
	}

	logger.info(`Processing ${jobs.length} queued emails`);

	for (const job of jobs) {
		await deliverEmailOutboxJob(job);
	}
}

async function deliverEmailOutboxJob(job: EmailOutbox) {
	logger.info(`Sending email ${job.id} to ${job.recipients.join(', ')}`);

	try {
		await sendQueuedEmail(job);

		await db.emailOutbox.update({
			where: { id: job.id },
			data: {
				status: 'Completed',
				completedAt: new Date(),
				retryAfter: null
			}
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		const nextAttempts = job.failedAttempts + 1;

		if (nextAttempts >= EMAIL_OUTBOX_MAX_ATTEMPTS) {
			await db.emailOutbox.update({
				where: { id: job.id },
				data: {
					status: 'Failed',
					failedAttempts: nextAttempts
				}
			});

			logger.error(err, `Email outbox job ${job.id} failed permanently`);
			return;
		}

		const exponentialDelayMs = Math.min(2 ** job.failedAttempts * 1000, EMAIL_OUTBOX_MAX_DELAY_MS);
		const retryDelayMs = EMAIL_OUTBOX_INITIAL_DELAY_MS + exponentialDelayMs;
		const retryAfter = new Date(Date.now() + retryDelayMs);

		await db.emailOutbox.update({
			where: { id: job.id },
			data: {
				failedAttempts: nextAttempts,
				retryAfter
			}
		});

		logger.warn(
			err,
			`Email outbox job ${job.id} failed; retrying in ${retryDelayMs / 1000} seconds`
		);
	}
}

async function runChecks() {
	const now = new Date();
	const staleBefore = new Date(now.getTime() - CHECK_INTERVAL_MS);
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
			logger.warn(`[${domain.name}] Check failed: ${dbErrorMessage}`);
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
				lastNotifiedAt: shouldNotify ? now : domain.lastNotifiedAt
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
		statusLabel: metadata.label,
		statusClass: metadata.className,
		expiresIn: formatExpiresIn(daysRemaining, status),
		expiresDate: formatExpirationDate(notAfter),
		issuer: issuer ?? 'Unknown',
		settingsUrl
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

async function runHeartbeat() {
	const now = new Date();
	const users = await db.user.findMany({
		where: { confirmed: true, sendHeartbeatReport: true },
		include: { domains: { where: { confirmed: true } } }
	});

	logger.info(`Found ${users.length} users to consider for heartbeat report`);

	for (const user of users) {
		if (user.domains.length === 0) {
			continue;
		}

		const lastSent = user.lastHeartbeatSentAt;
		if (lastSent && now.getTime() - lastSent.getTime() < HEARTBEAT_PERIOD_MS) {
			continue;
		}

		const domainInfo = user.domains
			.filter((domain) => domain.notAfter)
			.map((domain) => {
				const expirationDate = domain.notAfter!;
				const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / 86_400_000);
				const status = domain.status;
				return {
					domain: domain.name,
					expiresIn: formatExpiresIn(daysRemaining, status),
					expiresDate: formatExpirationDate(expirationDate),
					issuer: domain.issuer,
					status
				};
			});

		const critical = domainInfo.filter(
			(domain) =>
				domain.status === DomainStatus.EXPIRED ||
				domain.status === DomainStatus.EXPIRING_1DAY ||
				domain.status === DomainStatus.EXPIRING_7DAYS
		);

		const warning = domainInfo.filter(
			(domain) =>
				domain.status === DomainStatus.EXPIRING_14DAYS ||
				domain.status === DomainStatus.EXPIRING_30DAYS
		);

		const healthy = domainInfo.filter((domain) => domain.status === DomainStatus.OK);

		logger.info(`Sending heartbet report to user ${user.email}`);

		await queueHeartbeatEmail(
			user.email,
			now.toISOString().split('T')[0],
			critical,
			warning,
			healthy,
			user.domains.length,
			user.settingsToken
		);

		await db.user.update({
			where: { id: user.id },
			data: { lastHeartbeatSentAt: now }
		});
	}
}

async function queueHeartbeatEmail(
	to: string,
	generatedDate: string,
	critical: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[],
	warning: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[],
	healthy: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[],
	totalDomains: number,
	settingsToken: string
) {
	const settingsUrl = `${env.WEBSITE_URL}/?token=${settingsToken}`;
	const html = renderHeartbeatEmail({
		generatedDate,
		critical,
		warning,
		healthy,
		totalDomains,
		settingsUrl
	});

	await db.emailOutbox.create({
		data: {
			recipients: [to],
			subject: 'Your certificate status report',
			body: html,
			templateName: 'Heartbeat',
			priority: EmailOutboxPriorities.Low
		}
	});
}
