import { error } from '@sveltejs/kit';
import {
	renderConfirmationEmail,
	renderConfirmedDomainsEmail,
	renderExpiringDomainEmail,
	renderHeartbeatEmail
} from '$lib/server/email-templates';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { formatExpirationDate } from '$lib/server/utils';

function formatDate(date: Date): string {
	return date.toISOString().split('T')[0];
}

function daysFromNow(days: number): Date {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date;
}

function makeCert(domain: string, days: number) {
	const expirationDate = daysFromNow(days);
	return {
		domain,
		expiresIn: `in ${days} days`,
		expiresDate: formatExpirationDate(expirationDate),
		issuer: "Let's Encrypt"
	};
}

const previewData = {
	confirmation: {
		confirmUrl: `${env.WEBSITE_URL}/confirm?token=abc123XYZ456def789GHI012jkl345MNO678pqr901STU234vwx567YZA890bcd`
	},
	'confirmed-domains': {
		domains: ['example.com', 'api.example.com', 'www.example.org'],
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`
	},
	heartbeat: () => ({
		generatedDate: formatDate(new Date()),
		critical: [makeCert('example.com', 3), makeCert('api.example.com', 5)],
		warning: [makeCert('staging.example.com', 15), makeCert('test.example.com', 22)],
		healthy: [
			makeCert('www.example.com', 67),
			makeCert('blog.example.com', 89),
			makeCert('shop.example.com', 120)
		],
		totalDomains: 7,
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`
	}),
	expiring: {
		domain: 'example.com',
		statusLabel: 'EXPIRING IN 7 DAYS',
		statusClass: 'critical',
		expiresIn: 'in 7 days',
		expiresDate: formatExpirationDate(daysFromNow(7)),
		issuer: "Let's Encrypt",
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`
	}
};

export const GET: RequestHandler = async ({ params }) => {
	const { template } = params;

	let html: string;
	if (template === 'confirmation') {
		html = renderConfirmationEmail(previewData.confirmation);
	} else if (template === 'confirmed-domains') {
		html = renderConfirmedDomainsEmail(previewData['confirmed-domains']);
	} else if (template === 'heartbeat') {
		html = renderHeartbeatEmail(previewData.heartbeat());
	} else if (template === 'expiring') {
		html = renderExpiringDomainEmail(previewData.expiring);
	} else {
		throw error(404, `Template '${template}' not found`);
	}

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
};
