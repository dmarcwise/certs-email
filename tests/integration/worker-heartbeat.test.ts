import { describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { runHeartbeat } from '#lib/server/worker-heartbeat.ts';
import { DomainStatus } from '#prisma/generated/enums.ts';
import { createDomain, createUser, daysFromNow, getOutbox } from '../support/fixtures';

function section(text: string, title: string) {
	const start = text.indexOf(title);
	if (start === -1) return null;
	const end = text.indexOf('\n\n', text.indexOf('\n\n', start) + 2);
	return text.slice(start, end);
}

describe('runHeartbeat', () => {
	it('queues a report grouping the domains by status', async () => {
		const user = await createUser();
		const domain = (name: string, data: Parameters<typeof createDomain>[1]) =>
			createDomain(user.id, { name, issuer: "Let's Encrypt", ...data });

		await domain('critical.example.com', {
			status: DomainStatus.EXPIRING_7DAYS,
			notAfter: daysFromNow(5),
		});
		await domain('warning.example.com', {
			status: DomainStatus.EXPIRING_30DAYS,
			notAfter: daysFromNow(20),
		});
		await domain('healthy.example.com', { status: DomainStatus.OK, notAfter: daysFromNow(60) });
		await domain('pending.example.com', { status: DomainStatus.PENDING });
		await domain('broken.example.com', {
			status: DomainStatus.OK,
			notAfter: daysFromNow(60),
			error: 'TLS connection timed out',
			errorStartedAt: daysFromNow(-2),
		});
		// Errors within the grace period are not reported yet
		await domain('flaky.example.com', {
			status: DomainStatus.OK,
			notAfter: daysFromNow(60),
			error: 'TLS connection failed',
			errorStartedAt: daysFromNow(-0.1),
		});
		await domain('unconfirmed.example.com', { confirmed: false, status: DomainStatus.OK });

		await runHeartbeat();

		const outbox = await getOutbox();
		expect(outbox).toHaveLength(1);
		expect(outbox[0]).toMatchObject({
			recipients: [user.email],
			subject: 'Your certificate status report',
			templateName: 'Heartbeat',
		});

		const text = outbox[0].textBody!;
		expect(section(text, 'CRITICAL')).toContain('critical.example.com');
		expect(section(text, 'WARNING')).toContain('warning.example.com');
		expect(section(text, 'ERRORS')).toContain('broken.example.com');
		expect(section(text, 'ERRORS')).toContain('TLS connection timed out');
		expect(section(text, 'HEALTHY')).toContain('healthy.example.com');
		expect(section(text, 'HEALTHY')).toContain('flaky.example.com');
		expect(section(text, 'PENDING')).toContain('pending.example.com');
		expect(text).toContain('Total domains monitored: 6');
		expect(text).not.toContain('unconfirmed.example.com');
		expect(text).toContain(`https://certs.test/?token=${user.settingsToken}`);
		expect(outbox[0].body).toContain('critical.example.com');

		const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
		expect(updated.lastHeartbeatSentAt).toBeInstanceOf(Date);
	});

	it('sends the report every 14 days', async () => {
		const recent = await createUser({ lastHeartbeatSentAt: daysFromNow(-13) });
		await createDomain(recent.id, { status: DomainStatus.OK });
		const due = await createUser({ lastHeartbeatSentAt: daysFromNow(-15) });
		await createDomain(due.id, { status: DomainStatus.OK });

		await runHeartbeat();

		const outbox = await getOutbox();
		expect(outbox.map((email) => email.recipients)).toEqual([[due.email]]);

		// Running again right away does not send another report
		await runHeartbeat();
		expect(await getOutbox()).toHaveLength(1);
	});

	it('skips users who disabled the report, are unconfirmed, or have no confirmed domains', async () => {
		const disabled = await createUser({ sendHeartbeatReport: false });
		await createDomain(disabled.id);
		const unconfirmed = await createUser({ confirmed: false });
		await createDomain(unconfirmed.id);
		const noDomains = await createUser();
		await createDomain(noDomains.id, { confirmed: false });

		await runHeartbeat();

		expect(await getOutbox()).toEqual([]);
	});
});
