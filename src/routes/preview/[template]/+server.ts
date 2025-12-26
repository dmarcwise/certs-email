import { error } from '@sveltejs/kit';
import { renderConfirmationEmail } from '$lib/server/email-templates';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const previewData = {
	confirmation: {
		confirmUrl: `${env.WEBSITE_URL}/confirm?token=abc123XYZ456def789GHI012jkl345MNO678pqr901STU234vwx567YZA890bcd`
	}
};

const renderers = {
	confirmation: renderConfirmationEmail
};

export const GET: RequestHandler = async ({ params }) => {
	const { template } = params;

	if (!(template in renderers)) {
		throw error(404, `Template '${template}' not found`);
	}

	const renderer = renderers[template as keyof typeof renderers];
	const data = previewData[template as keyof typeof previewData];

	const html = renderer(data);

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
};
