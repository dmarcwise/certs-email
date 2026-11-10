import { describe, expect, it } from 'vitest';
import Handlebars from 'handlebars';
import {
	renderCertificateChangedEmail,
	renderConfirmationEmail,
	renderConfirmedDomainsEmail,
	renderExpiringDomainEmail,
	renderHeartbeatEmail,
} from '#lib/server/email-templates.ts';

const settingsUrl = 'https://certs.test/?token=settings-token';

function expectRendered(email: { html: string; text: string }, ...values: string[]) {
	expect(email.html).toMatch(/^<!DOCTYPE html>/i);
	// The shared styles are inlined by juice
	expect(email.html).toMatch(/<body style="[^"]*font-family:/);
	expect(email.html).toMatch(/<div class="container" style="[^"]*max-width: 600px/);
	expect(email.html).not.toContain('{{');
	expect(email.text).not.toContain('{{');

	for (const value of values) {
		expect(email.html).toContain(Handlebars.escapeExpression(value));
		expect(email.text).toContain(value);
	}
}

describe('email templates', () => {
	it('renders the confirmation email', () => {
		expectRendered(
			renderConfirmationEmail({ confirmUrl: 'https://certs.test/confirm?token=abc' }),
			'https://certs.test/confirm?token=abc',
		);
	});

	it('renders the confirmed domains email', () => {
		expectRendered(
			renderConfirmedDomainsEmail({ domains: ['a.example.com', 'b.example.com'], settingsUrl }),
			'a.example.com',
			'b.example.com',
			settingsUrl,
		);
	});

	it('renders the expiring domain email', () => {
		expectRendered(
			renderExpiringDomainEmail({
				domain: 'expiring.example.com',
				expiresIn: 'in 5 days',
				validUntil: '2026-11-15 10:00 UTC',
				validFrom: '2026-08-15 10:00 UTC',
				issuer: 'Test CA',
				cn: 'expiring.example.com',
				san: ['expiring.example.com', 'www.expiring.example.com'],
				serial: 'SERIAL-123',
				settingsUrl,
				isCritical: true,
				isExpired: false,
			}),
			'expiring.example.com',
			'2026-11-15 10:00 UTC',
			'Test CA',
			'SERIAL-123',
			settingsUrl,
		);
	});

	it('renders the certificate changed email', () => {
		const cert = (serial: string, issuer: string) => ({
			domain: 'changed.example.com',
			issuer,
			validFrom: '2026-08-15 10:00 UTC',
			validUntil: '2026-11-15 10:00 UTC',
			serial,
			cn: 'changed.example.com',
			san: ['changed.example.com'],
		});

		expectRendered(
			renderCertificateChangedEmail({
				domain: 'changed.example.com',
				firstDetectedDate: '2026-11-10 10:00 UTC',
				oldCert: cert('OLD-SERIAL', 'Old CA'),
				newCert: cert('NEW-SERIAL', 'New CA'),
				settingsUrl,
			}),
			'changed.example.com',
			'OLD-SERIAL',
			'NEW-SERIAL',
			'Old CA',
			'New CA',
			settingsUrl,
		);
	});

	it('renders the heartbeat email', () => {
		const info = (domain: string) => ({
			domain,
			expiresIn: 'in 5 days',
			expiresDate: '2026-11-15 10:00 UTC',
			issuer: 'Test CA',
		});

		expectRendered(
			renderHeartbeatEmail({
				generatedDate: '2026-11-10',
				critical: [info('critical.example.com')],
				warning: [info('warning.example.com')],
				errors: [{ domain: 'broken.example.com', error: 'TLS connection failed' }],
				healthy: [info('healthy.example.com')],
				pending: [{ domain: 'pending.example.com' }],
				totalDomains: 5,
				settingsUrl,
			}),
			'2026-11-10',
			'critical.example.com',
			'warning.example.com',
			'broken.example.com',
			'TLS connection failed',
			'healthy.example.com',
			'pending.example.com',
			settingsUrl,
		);
	});
});
