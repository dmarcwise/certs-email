import { error } from '@sveltejs/kit';
import { renderConfirmationEmail, renderConfirmedDomainsEmail } from '$lib/server/email-templates';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const previewData = {
	confirmation: {
		confirmUrl: `${env.WEBSITE_URL}/confirm?token=abc123XYZ456def789GHI012jkl345MNO678pqr901STU234vwx567YZA890bcd`
	},
	'confirmed-domains': {
		domains: ['example.com', 'api.example.com', 'www.example.org'],
		settingsUrl: `${env.WEBSITE_URL}/settings?token=xyz123ABC456def789GHI012jkl345MNO678pqr901STU`
	}
};

export const GET: RequestHandler = async ({ params }) => {
	const { template } = params;

	let html: string;
	if (template === 'confirmation') {
		html = renderConfirmationEmail(previewData.confirmation);
	} else if (template === 'confirmed-domains') {
		html = renderConfirmedDomainsEmail(previewData['confirmed-domains']);
	} else {
		throw error(404, `Template '${template}' not found`);
	}

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
};
