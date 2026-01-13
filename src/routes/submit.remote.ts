import { form } from '$app/server';
import { z } from 'zod';
import { invalid, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createConfirmationToken, generateToken } from '$lib/server/utils';
import { EmailOutboxPriorities } from '$lib/server/email';
import { createLogger } from '$lib/server/logger';
import { DomainStatus } from '$prisma/generated/enums';
import { renderConfirmationEmail } from '$lib/server/email-templates';
import { env } from '$env/dynamic/private';

const logger = createLogger('submit');

const domainRegex = new RegExp(
	'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
);

const MAX_DOMAINS_PER_USER = 20;

export const submit = form(
	z.object({
		domains: z.string(),
		email: z.email(),
		settingsToken: z.string().optional()
	}),
	async ({ domains, email, settingsToken }, issue) => {
		// Parse and validate domains
		const sanitizedDomains = domains
			.split('\n')
			.map((domain) => domain.trim().toLowerCase())
			.filter((domain) => domain.length > 0);
		const uniqueDomains = [...new Set(sanitizedDomains)];

		if (uniqueDomains.length === 0) {
			invalid(issue.domains('Enter at least one valid domain'));
		}

		for (const domain of uniqueDomains) {
			if (!domainRegex.test(domain)) {
				invalid(issue.domains(`Invalid domain: ${domain}`));
			}
		}

		const isEdit = !!settingsToken;

		if (isEdit) {
			const user = await db.user.findUnique({
				where: { settingsToken },
				include: { domains: true }
			});

			if (!user) {
				invalid(issue.settingsToken('Invalid or expired settings link.'));
			}

			if (uniqueDomains.length > MAX_DOMAINS_PER_USER) {
				invalid(
					issue.domains(
						`You can only monitor up to ${MAX_DOMAINS_PER_USER} domains. Your updated list has ${uniqueDomains.length}.`
					)
				);
			}

			const existingDomains = new Set(user.domains.map((domain) => domain.name));
			const domainsToCreate = uniqueDomains.filter((name) => !existingDomains.has(name));
			const domainsToRemove = user.domains
				.map((domain) => domain.name)
				.filter((name) => !uniqueDomains.includes(name));

			if (domainsToRemove.length > 0) {
				await db.domain.deleteMany({
					where: {
						userId: user.id,
						name: { in: domainsToRemove }
					}
				});
			}

			if (domainsToCreate.length > 0) {
				await db.domain.createMany({
					data: domainsToCreate.map((name) => ({
						userId: user.id,
						name,
						confirmed: user.confirmed,
						status: DomainStatus.PENDING
					}))
				});
			}

			logger.info(
				{ email: user.email, domainCount: uniqueDomains.length },
				`Settings updated for user ${user.email}`
			);

			redirect(303, `/success?message=updated`);
		}

		email = email.trim().toLowerCase();

		logger.info({ email, domainCount: uniqueDomains.length }, `New submission for ${email}`);

		// Find or create user
		let user = await db.user.findUnique({
			where: { email },
			include: { domains: true }
		});

		const isNewUser = !user;

		if (!user) {
			// Create new user with tokens
			const { token, expiresAt } = createConfirmationToken();
			const settingsToken = generateToken();

			user = await db.user.create({
				data: {
					email,
					confirmed: false,
					confirmToken: token,
					confirmTokenExpiresAt: expiresAt,
					settingsToken,
					sendHeartbeatReport: true
				},
				include: { domains: true }
			});
		}

		// Check domain limit
		const currentDomainCount = user.domains.length;
		const newDomainCount = uniqueDomains.length;

		if (currentDomainCount + newDomainCount > MAX_DOMAINS_PER_USER) {
			const remaining = MAX_DOMAINS_PER_USER - currentDomainCount;
			invalid(
				issue.domains(
					`You can only monitor up to ${MAX_DOMAINS_PER_USER} domains. You currently have ${currentDomainCount} domain(s), so you can add ${remaining} more.`
				)
			);
		}

		// Extract new domains to create
		const existingDomainNames = new Set(user.domains.map((d) => d.name));
		const domainsToCreate = uniqueDomains.filter((name) => !existingDomainNames.has(name));

		if (domainsToCreate.length > 0) {
			const userId = user.id;

			// Create new domains as unconfirmed
			await db.domain.createMany({
				data: domainsToCreate.map((name) => ({
					userId,
					name,
					confirmed: false, // Requires email confirmation
					status: DomainStatus.PENDING
				}))
			});
		}

		// Generate new confirmation token if user is existing and adding new domains
		if (!isNewUser) {
			const { token, expiresAt } = createConfirmationToken();

			user = await db.user.update({
				where: { id: user.id },
				data: {
					confirmToken: token,
					confirmTokenExpiresAt: expiresAt
				},
				include: { domains: true }
			});
		}

		// Send confirmation email
		if (user.confirmToken) {
			logger.info({ email }, `Queueing confirmation email for user ${email}`);
			await queueConfirmationEmail(email, user.confirmToken);
		}

		redirect(303, '/success');
	}
);

async function queueConfirmationEmail(to: string, confirmToken: string) {
	const confirmUrl = `${env.WEBSITE_URL}/confirm?token=${confirmToken}`;
	const html = renderConfirmationEmail({ confirmUrl });

	await db.emailOutbox.create({
		data: {
			recipients: [to],
			subject: 'Confirm your certs.email subscription',
			body: html,
			templateName: 'Confirmation',
			priority: EmailOutboxPriorities.High
		}
	});
}
