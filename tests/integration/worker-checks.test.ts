import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db.ts';
import { runChecks } from '#lib/server/worker-checks.ts';
import { CertFetchError, type CertificateInfo, fetchCertificate } from '#lib/server/fetch-cert.ts';
import { DomainStatus } from '#prisma/generated/enums.ts';
import { createDomain, createUser, DAY_MS, daysFromNow, getOutbox } from '../support/fixtures';

vi.mock('#lib/server/fetch-cert.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/fetch-cert.ts')>()),
	fetchCertificate: vi.fn(),
}));

const fetchCertificateMock = vi.mocked(fetchCertificate);

function makeCert(overrides: Partial<CertificateInfo> = {}): CertificateInfo {
	return {
		notBefore: daysFromNow(-30),
		notAfter: daysFromNow(60),
		issuer: "Let's Encrypt",
		cn: 'example.com',
		san: ['example.com', 'www.example.com'],
		serial: '0A1B2C',
		fingerprint256: 'AA:BB:CC',
		ip: '93.184.216.34',
		...overrides,
	};
}

beforeEach(() => {
	fetchCertificateMock.mockReset();
	fetchCertificateMock.mockResolvedValue(makeCert());
});

describe('runChecks', () => {
	it('only checks confirmed domains of confirmed users that are due for a check', async () => {
		const user = await createUser();
		const due = await createDomain(user.id, { name: 'due.example.com', port: 8443 });
		await createDomain(user.id, { name: 'stale.example.com', lastCheckedAt: daysFromNow(-1) });
		await createDomain(user.id, { name: 'recent.example.com', lastCheckedAt: new Date() });
		await createDomain(user.id, { name: 'unconfirmed.example.com', confirmed: false });

		const unconfirmedUser = await createUser({ confirmed: false });
		await createDomain(unconfirmedUser.id, { name: 'user-unconfirmed.example.com' });

		await runChecks();

		const checked = fetchCertificateMock.mock.calls.map(([name, port]) => `${name}:${port}`);
		expect(checked.sort()).toEqual(['due.example.com:8443', 'stale.example.com:443']);
		expect(await db.check.count({ where: { domainId: due.id } })).toBe(1);
	});

	it('stores the certificate details on the first check without sending emails', async () => {
		const user = await createUser();
		const domain = await createDomain(user.id);
		const cert = makeCert();
		fetchCertificateMock.mockResolvedValue(cert);

		await runChecks();

		const updated = await db.domain.findUniqueOrThrow({ where: { id: domain.id } });
		expect(updated).toMatchObject({
			status: DomainStatus.OK,
			notBefore: cert.notBefore,
			notAfter: cert.notAfter,
			issuer: cert.issuer,
			cn: cert.cn,
			san: cert.san,
			serial: cert.serial,
			fingerprint: cert.fingerprint256,
			ip: cert.ip,
			error: null,
		});
		expect(updated.lastCheckedAt).toBeInstanceOf(Date);

		const checks = await db.check.findMany({ where: { domainId: domain.id } });
		expect(checks).toHaveLength(1);
		expect(checks[0]).toMatchObject({ fingerprint: cert.fingerprint256, error: null });

		expect(await getOutbox()).toEqual([]);
	});

	it.each([
		{ days: 20, status: DomainStatus.EXPIRING_30DAYS, subject: 'Certificate expiring in 30 days' },
		{ days: 10, status: DomainStatus.EXPIRING_14DAYS, subject: 'Certificate expiring in 14 days' },
		{ days: 5, status: DomainStatus.EXPIRING_7DAYS, subject: 'Certificate expiring in 7 days' },
		{ days: 0.5, status: DomainStatus.EXPIRING_1DAY, subject: 'Certificate expiring in 1 day' },
		{ days: -2, status: DomainStatus.EXPIRED, subject: 'Certificate expired' },
	])(
		'moves to $status and queues an email ($days days left)',
		async ({ days, status, subject }) => {
			const user = await createUser();
			const domain = await createDomain(user.id, {
				name: 'expiring.example.com',
				status: DomainStatus.OK,
				fingerprint: 'AA:BB:CC',
			});
			fetchCertificateMock.mockResolvedValue(makeCert({ notAfter: daysFromNow(days) }));

			await runChecks();

			const updated = await db.domain.findUniqueOrThrow({ where: { id: domain.id } });
			expect(updated.status).toBe(status);
			expect(updated.lastNotifiedAt).toBeInstanceOf(Date);

			const outbox = await getOutbox();
			expect(outbox).toHaveLength(1);
			expect(outbox[0]).toMatchObject({
				recipients: [user.email],
				subject: `${subject}: expiring.example.com`,
				templateName: 'Expiring',
				status: 'Pending',
			});
			expect(outbox[0].body).toContain('expiring.example.com');
			expect(outbox[0].textBody).toContain('expiring.example.com');
			expect(outbox[0].textBody).toContain(`https://certs.test/?token=${user.settingsToken}`);
		},
	);

	it('does not notify again when the status did not change', async () => {
		const user = await createUser();
		await createDomain(user.id, {
			status: DomainStatus.EXPIRING_30DAYS,
			fingerprint: 'AA:BB:CC',
		});
		fetchCertificateMock.mockResolvedValue(makeCert({ notAfter: daysFromNow(20) }));

		await runChecks();

		expect(await getOutbox()).toEqual([]);
	});

	it('queues a certificate changed email when the fingerprint changes', async () => {
		const user = await createUser();
		const domain = await createDomain(user.id, {
			name: 'changed.example.com',
			status: DomainStatus.OK,
			fingerprint: 'OLD:FINGERPRINT',
			serial: 'OLD-SERIAL',
			issuer: 'Old CA',
			notBefore: daysFromNow(-80),
			notAfter: daysFromNow(10),
		});
		fetchCertificateMock.mockResolvedValue(makeCert({ serial: 'NEW-SERIAL' }));

		await runChecks();

		const outbox = await getOutbox();
		expect(outbox).toHaveLength(1);
		expect(outbox[0]).toMatchObject({
			recipients: [user.email],
			subject: 'Certificate changed: changed.example.com',
			templateName: 'CertificateChanged',
		});
		expect(outbox[0].textBody).toContain('OLD-SERIAL');
		expect(outbox[0].textBody).toContain('NEW-SERIAL');

		const updated = await db.domain.findUniqueOrThrow({ where: { id: domain.id } });
		expect(updated.fingerprint).toBe('AA:BB:CC');
		expect(updated.lastCertChangeNotifiedAt).toBeInstanceOf(Date);
	});

	it('does not queue a certificate changed email when the user disabled the alerts', async () => {
		const user = await createUser({ sendCertChangeAlerts: false });
		await createDomain(user.id, {
			status: DomainStatus.OK,
			fingerprint: 'OLD:FINGERPRINT',
			notBefore: daysFromNow(-80),
			notAfter: daysFromNow(10),
		});

		await runChecks();

		expect(await getOutbox()).toEqual([]);
	});

	it('records fetch errors and keeps the original error start date', async () => {
		const user = await createUser();
		const errorStartedAt = new Date(Date.now() - 2 * DAY_MS);
		const failing = await createDomain(user.id, { error: 'Old error', errorStartedAt });
		const failingNew = await createDomain(user.id);

		fetchCertificateMock.mockImplementation(async (name) => {
			if (name === failing.name) throw new CertFetchError('TLS connection timed out');
			throw new Error('Something unexpected');
		});

		await runChecks();

		const updatedFailing = await db.domain.findUniqueOrThrow({ where: { id: failing.id } });
		expect(updatedFailing).toMatchObject({
			error: 'TLS connection timed out',
			errorStartedAt,
			status: DomainStatus.PENDING,
		});

		const updatedFailingNew = await db.domain.findUniqueOrThrow({ where: { id: failingNew.id } });
		expect(updatedFailingNew.error).toBe('Unknown error');
		expect(updatedFailingNew.errorStartedAt).toBeInstanceOf(Date);

		const checks = await db.check.findMany({ orderBy: { domainId: 'asc' } });
		expect(checks.map((check) => check.error)).toEqual([
			'TLS connection timed out',
			'Unknown error',
		]);
		expect(await getOutbox()).toEqual([]);
	});

	it('clears the error after a successful check', async () => {
		const user = await createUser();
		const domain = await createDomain(user.id, {
			error: 'TLS connection failed',
			errorStartedAt: daysFromNow(-1),
		});

		await runChecks();

		const updated = await db.domain.findUniqueOrThrow({ where: { id: domain.id } });
		expect(updated).toMatchObject({ error: null, errorStartedAt: null, status: DomainStatus.OK });
	});
});
