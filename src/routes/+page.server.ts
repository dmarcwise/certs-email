import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
	const settingsToken = url.searchParams.get('token');

	if (!settingsToken) {
		return {};
	}

	const user = await db.user.findUnique({
		where: { settingsToken },
		include: { domains: true }
	});

	if (!user) {
		return { isTokenInvalid: true };
	}

	const domains = user.domains
		.map((domain) => domain.name)
		.sort((first, second) => first.localeCompare(second));

	return {
		edit: {
			token: settingsToken,
			email: user.email,
			domains: domains.join('\n')
		}
	};
};
