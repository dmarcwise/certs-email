import { form } from '$app/server';
import { z } from 'zod';
import { invalid, redirect } from '@sveltejs/kit';

const domainRegex = new RegExp(
	'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
);

export const submit = form(
	z.object({
		domains: z.string(),
		email: z.email()
	}),
	async ({ domains, email }, issue) => {
		console.log(domains, email);

		const sanitizedDomains = domains.split('\n').map((domain) => domain.trim());
		if (sanitizedDomains.length === 0) {
			invalid(issue.domains('Enter at least one valid domain'));
		}

		for (const domain of sanitizedDomains) {
			if (!domain) {
				continue;
			}

			if (!domainRegex.test(domain)) {
				invalid(issue.domains(`Invalid domain: ${domain}`));
			}
		}

		email = email.trim().toLowerCase();

		redirect(303, '/success');
	}
);
