import { form } from '$app/server';
import { z } from 'zod';
import { redirect } from '@sveltejs/kit';

export const submit = form(
	z.object({
		domains: z.string(),
		email: z.email()
	}),
	async ({ domains, email }) => {
		console.log(domains, email);

		redirect(303, '/success');
	}
);
