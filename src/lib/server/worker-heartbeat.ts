import { createLogger } from '$lib/server/logger';
import { db } from '$lib/server/db';
import { type Domain, DomainStatus } from '$prisma/generated/client';
import { formatExpirationDate, formatExpiresIn } from '$lib/server/utils';
import { renderHeartbeatEmail } from '$lib/server/email-templates';
import { EmailOutboxPriorities } from '$lib/server/email';
import { env } from '$env/dynamic/private';

export const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HEARTBEAT_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const HEARTBEAT_ERROR_GRACE_MS = 24 * 60 * 60 * 1000; // 24 hours

const logger = createLogger('worker-heartbeat');

export async function runHeartbeat() {
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

		const errorCutoff = new Date(now.getTime() - HEARTBEAT_ERROR_GRACE_MS);
		const isErrorDomain = (domain: Domain) =>
			Boolean(domain.error && domain.errorStartedAt && domain.errorStartedAt <= errorCutoff);
		const domainsInError = user.domains.filter(isErrorDomain).map((domain) => ({
			domain: domain.name,
			error: domain.error!
		}));
		const activeDomains = user.domains.filter((domain) => !isErrorDomain(domain));

		const pending = activeDomains
			.filter((domain) => domain.status === DomainStatus.PENDING)
			.map((domain) => ({
				domain: domain.name
			}));

		const domainInfo = activeDomains
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

		logger.info(`Sending heartbeat report to user ${user.email}`);

		await queueHeartbeatEmail(
			user.email,
			now.toISOString().split('T')[0],
			critical,
			warning,
			domainsInError,
			healthy,
			pending,
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
	errors: { domain: string; error: string }[],
	healthy: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[],
	pending: { domain: string }[],
	totalDomains: number,
	settingsToken: string
) {
	const settingsUrl = `${env.WEBSITE_URL}/?token=${settingsToken}`;
	const html = renderHeartbeatEmail({
		generatedDate,
		critical,
		warning,
		errors,
		healthy,
		pending,
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
