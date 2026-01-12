import { DomainStatus, type Prisma } from '$prisma/generated/client';
import { db } from './db';
import { CertFetchError, type CertificateInfo, fetchCertificate } from './fetch-cert';
import { computeDomainStatus } from './status';
import { sendExpiringDomainEmail, sendHeartbeatEmail, type ExpirationStatus } from './email';
import { createLogger } from './logger';
import { formatExpirationDate, formatExpiresIn } from '$lib/server/utils';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HEARTBEAT_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

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
		await sendExpiringDomainEmail(domain.user.email, nextStatus as ExpirationStatus, {
			domain: domain.name,
			notAfter: cert.notAfter,
			issuer: cert.issuer,
			settingsToken: domain.user.settingsToken
		});
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

		const settingsToken = user.settingsToken;
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

		await sendHeartbeatEmail(user.email, {
			generatedDate: now.toISOString().split('T')[0],
			critical,
			warning,
			healthy,
			totalDomains: user.domains.length,
			settingsToken
		});

		await db.user.update({
			where: { id: user.id },
			data: { lastHeartbeatSentAt: now }
		});
	}
}
