import { expect, test } from '@playwright/test';
import type { SentEmail } from '../support/fake-lettermint.ts';

// The worker polls the email outbox every 500ms in E2E tests (see the global setup)
const EMAIL_TIMEOUT_MS = 10_000;

function uniqueEmail() {
	return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function waitForEmail(to: string, subject: string): Promise<SentEmail> {
	let found: SentEmail | undefined;

	await expect
		.poll(
			async () => {
				const response = await fetch(process.env.E2E_EMAILS_URL!);
				const emails: SentEmail[] = await response.json();
				found = emails.find((email) => email.to.includes(to) && email.subject === subject);
				return found;
			},
			{ message: `email "${subject}" to ${to}`, timeout: EMAIL_TIMEOUT_MS, intervals: [500] },
		)
		.toBeDefined();

	return found!;
}

function extractUrl(email: SentEmail, pattern: RegExp) {
	const url = email.text?.match(pattern)?.[0];
	expect(url, `URL matching ${pattern} in "${email.subject}"`).toBeDefined();
	return url!;
}

test('subscribe, confirm, update settings and unsubscribe', async ({ page }) => {
	test.setTimeout(120_000);
	const email = uniqueEmail();

	await test.step('subscribe', async () => {
		await page.goto('/');
		await page
			.getByLabel('Domain names')
			.fill('b.example.test\n A.example.test \n\nb.example.test');
		await page.getByLabel('Email address').fill(email);
		await page.getByRole('button', { name: 'Subscribe to notifications' }).click();

		await expect(page).toHaveURL('/success');
		await expect(page.getByText("We've sent you a verification link via email.")).toBeVisible();
	});

	const confirmEmail = await waitForEmail(email, 'Confirm your certs.email subscription');
	expect(confirmEmail.token).toBe('test-token');
	expect(confirmEmail.tag).toBe('PROD-CERTS-Confirmation');
	const confirmUrl = extractUrl(confirmEmail, /http:\/\/localhost:\d+\/confirm\?token=\w+/);

	await test.step('confirm', async () => {
		await page.goto(confirmUrl);
		await page.getByRole('button', { name: 'Confirm email address' }).click();

		await expect(page).toHaveURL('/confirmed');
		await expect(page.getByText('Your email has been successfully confirmed.')).toBeVisible();
	});

	const confirmedEmail = await waitForEmail(email, 'Your domains are now being monitored');
	expect(confirmedEmail.text).toContain('- a.example.test');
	expect(confirmedEmail.text).toContain('- b.example.test');
	const settingsUrl = extractUrl(confirmedEmail, /http:\/\/localhost:\d+\/\?token=\w+/);

	await test.step('update settings', async () => {
		await page.goto(settingsUrl);

		await expect(page.getByText(`Update the domains monitored for ${email}`)).toBeVisible();
		await expect(page.getByLabel('Domain names')).toHaveValue('a.example.test\nb.example.test');
		await expect(page.getByLabel('Certificate change alerts')).toBeChecked();
		await expect(page.getByLabel('Heartbeat reports')).toBeChecked();

		await page.getByLabel('Domain names').fill('a.example.test\nc.example.test');
		await page.getByLabel('Heartbeat reports').uncheck();
		await page.getByRole('button', { name: 'Update monitoring settings' }).click();

		await expect(page).toHaveURL('/success?message=updated');
		await expect(page.getByText('Your monitoring settings have been updated.')).toBeVisible();

		await page.goto(settingsUrl);
		await expect(page.getByLabel('Domain names')).toHaveValue('a.example.test\nc.example.test');
		await expect(page.getByLabel('Certificate change alerts')).toBeChecked();
		await expect(page.getByLabel('Heartbeat reports')).not.toBeChecked();
	});

	await test.step('unsubscribe', async () => {
		await page.getByRole('button', { name: 'Unsubscribe from all notifications' }).click();

		await expect(page).toHaveURL('/success?message=unsubscribed');
		await expect(page.getByText("You've been unsubscribed from certs.email.")).toBeVisible();

		await page.goto(settingsUrl);
		await expect(page.getByText('Invalid or expired settings link.')).toBeVisible();
	});
});

test('rejects invalid domains', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Domain names').fill('example.test\nnot a domain');
	await page.getByLabel('Email address').fill(uniqueEmail());
	await page.getByRole('button', { name: 'Subscribe to notifications' }).click();

	await expect(page.getByText('Invalid domain: not a domain')).toBeVisible();
	await expect(page).toHaveURL('/');
});

test('limits the number of domains per user', async ({ page }) => {
	const domains = Array.from({ length: 21 }, (_, i) => `d${i}.example.test`);

	await page.goto('/');
	await page.getByLabel('Domain names').fill(domains.join('\n'));
	await page.getByLabel('Email address').fill(uniqueEmail());
	await page.getByRole('button', { name: 'Subscribe to notifications' }).click();

	await expect(page.getByText('You can only monitor up to 20 domains.')).toBeVisible();
});

test('rejects an invalid confirmation link', async ({ page }) => {
	await page.goto('/confirm?token=invalid');
	await page.getByRole('button', { name: 'Confirm email address' }).click();

	await expect(page.getByText('Invalid or expired confirmation link')).toBeVisible();
});

test('renders the static pages and email previews', async ({ page }) => {
	for (const path of [
		'/privacy-policy',
		'/preview/expiring',
		'/preview/certificate-changed',
		'/preview/heartbeat',
	]) {
		const response = await page.goto(path);
		expect(response?.status(), path).toBe(200);
	}
});
