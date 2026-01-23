import { error } from '@sveltejs/kit';
import {
	renderConfirmationEmail,
	renderConfirmedDomainsEmail,
	renderExpiringDomainEmail,
	renderHeartbeatEmail,
	renderCertificateChangedEmail
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
		errors: [{ domain: 'broken.example.com', error: 'DNS lookup failed' }],
		healthy: [
			makeCert('www.example.com', 67),
			makeCert('blog.example.com', 89),
			makeCert('shop.example.com', 120)
		],
		pending: [{ domain: 'pending.example.com' }],
		totalDomains: 9,
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`
	}),
	expiring: {
		domain: 'example.com',
		expiresIn: 'in 7 days',
		validUntil: formatExpirationDate(daysFromNow(7)),
		validFrom: formatExpirationDate(daysFromNow(-60)),
		issuer: "Let's Encrypt",
		cn: '*.example.com',
		san: ['example.com', '*.example.com', 'www.example.com'],
		serial: '03A12B4C5D6E7F890ABCDEF0123456789ABC',
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`,
		isCritical: true,
		isExpired: false
	},
	'expiring-warning': {
		domain: 'api.example.com',
		expiresIn: 'in 14 days',
		validUntil: formatExpirationDate(daysFromNow(14)),
		validFrom: formatExpirationDate(daysFromNow(-76)),
		issuer: "Let's Encrypt",
		cn: 'api.example.com',
		san: ['api.example.com'],
		serial: '05C34D6E7F890ABCDEF0123456789ABCDE',
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`,
		isCritical: false,
		isExpired: false
	},
	'expiring-expired': {
		domain: 'legacy.example.com',
		expiresIn: 'expired',
		validUntil: formatExpirationDate(daysFromNow(-2)),
		validFrom: formatExpirationDate(daysFromNow(-92)),
		issuer: "Let's Encrypt",
		cn: 'legacy.example.com',
		san: ['legacy.example.com'],
		serial: '02D45E7F890ABCDEF0123456789ABCDEF',
		settingsUrl: `${env.WEBSITE_URL}/?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`,
		isCritical: true,
		isExpired: true
	},
	'certificate-changed': {
		domain: 'example.com',
		firstDetectedDate: formatExpirationDate(new Date()),
		oldCert: {
			domain: 'example.com',
			issuer: "Let's Encrypt",
			validFrom: formatExpirationDate(daysFromNow(-60)),
			validUntil: formatExpirationDate(daysFromNow(30)),
			serial: '03A12B4C5D6E7F890ABCDEF0123456789ABC',
			cn: 'example.com',
			san: ['example.com', 'www.example.com']
		},
		newCert: {
			domain: '*.example.com',
			issuer: "Let's Encrypt",
			validFrom: formatExpirationDate(daysFromNow(-1)),
			validUntil: formatExpirationDate(daysFromNow(89)),
			serial: '04B23C5D6E7F890ABCDEF0123456789ABCDE',
			cn: '*.example.com',
			san: ['example.com', '*.example.com', 'www.example.com']
		},
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
	} else if (template === 'expiring-warning') {
		html = renderExpiringDomainEmail(previewData['expiring-warning']);
	} else if (template === 'expiring-expired') {
		html = renderExpiringDomainEmail(previewData['expiring-expired']);
	} else if (template === 'certificate-changed') {
		html = renderCertificateChangedEmail(previewData['certificate-changed']);
	} else {
		throw error(404, `Template '${template}' not found`);
	}

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
};
