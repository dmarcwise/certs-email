import { env } from '$env/dynamic/private';
import { MailtrapClient } from 'mailtrap';
import { building, dev } from '$app/environment';
import { DomainStatus } from '$prisma/generated/enums';
import {
	renderConfirmationEmail,
	renderConfirmedDomainsEmail,
	renderExpiringDomainEmail,
	renderHeartbeatEmail
} from './email-templates';
import { formatExpirationDate, formatExpiresIn } from '$lib/server/utils';

if (!building && !env.MAILTRAP_API_KEY) throw new Error('MAILTRAP_API_KEY is not set');

const mailtrap = new MailtrapClient({
	token: env.MAILTRAP_API_KEY!
});

const defaultFrom = { name: 'certs.email', email: 'support@certs.email' };

const EXPIRATION_EMAIL_METADATA: Record<
	DomainStatus,
	{ label: string; className: string; subject: string }
> = {
	// TODO: do we actually notify pending?
	[DomainStatus.PENDING]: {
		label: 'PENDING',
		className: 'warning',
		subject: 'Certificate status pending'
	},
	[DomainStatus.OK]: {
		label: 'OK',
		className: 'healthy',
		subject: 'Certificate is healthy'
	},
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

export async function sendConfirmationEmail(to: string, confirmToken: string) {
	const confirmUrl = `${env.WEBSITE_URL}/confirm?token=${confirmToken}`;

	const html = renderConfirmationEmail({ confirmUrl });

	await mailtrap.send({
		from: defaultFrom,
		to: [{ email: to }],
		subject: 'Confirm your certs.email subscription',
		html,
		category: dev ? 'DEV-CERTS-Confirmation' : 'PROD-CERTS-Confirmation'
	});
}

export async function sendConfirmedDomainsEmail(
	to: string,
	domains: string[],
	settingsToken: string
) {
	const settingsUrl = `${env.WEBSITE_URL}/settings?token=${settingsToken}`;

	const html = renderConfirmedDomainsEmail({ domains, settingsUrl });

	await mailtrap.send({
		from: defaultFrom,
		to: [{ email: to }],
		subject: 'Your domains are now being monitored',
		html,
		category: dev ? 'DEV-CERTS-Confirmed' : 'PROD-CERTS-Confirmed'
	});
}

export async function sendExpiringDomainEmail(
	to: string,
	status: DomainStatus,
	data: {
		domain: string;
		notAfter: Date;
		issuer: string | null;
		settingsToken: string;
	}
) {
	const metadata = EXPIRATION_EMAIL_METADATA[status];
	const settingsUrl = `${env.WEBSITE_URL}/settings?token=${data.settingsToken}`;
	const daysRemaining = Math.ceil((data.notAfter.getTime() - Date.now()) / 86_400_000);

	const html = renderExpiringDomainEmail({
		domain: data.domain,
		statusLabel: metadata.label,
		statusClass: metadata.className,
		expiresIn: formatExpiresIn(daysRemaining, status),
		expiresDate: formatExpirationDate(data.notAfter),
		issuer: data.issuer ?? 'Unknown',
		settingsUrl
	});

	await mailtrap.send({
		from: defaultFrom,
		to: [{ email: to }],
		subject: `${metadata.subject}: ${data.domain}`,
		html,
		category: dev ? 'DEV-CERTS-Expiring' : 'PROD-CERTS-Expiring'
	});
}

export async function sendHeartbeatEmail(
	to: string,
	data: {
		generatedDate: string;
		critical: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[];
		warning: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[];
		healthy: { domain: string; expiresIn: string; expiresDate: string; issuer: string | null }[];
		totalDomains: number;
		settingsToken: string;
	}
) {
	const settingsUrl = `${env.WEBSITE_URL}/settings?token=${data.settingsToken}`;
	const html = renderHeartbeatEmail({
		generatedDate: data.generatedDate,
		critical: data.critical,
		warning: data.warning,
		healthy: data.healthy,
		totalDomains: data.totalDomains,
		settingsUrl
	});

	await mailtrap.send({
		from: defaultFrom,
		to: [{ email: to }],
		subject: 'Your certificate status report',
		html,
		category: dev ? 'DEV-CERTS-Heartbeat' : 'PROD-CERTS-Heartbeat'
	});
}
