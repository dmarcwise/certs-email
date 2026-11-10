import net, { type AddressInfo } from 'node:net';
import tls from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import selfsigned from 'selfsigned';
import { CertFetchError, fetchCertificate } from '#lib/server/fetch-cert.ts';

const notBefore = new Date('2026-01-01T00:00:00Z');
const notAfter = new Date('2027-01-01T00:00:00Z');

let certPem: string;
let tlsServer: tls.Server;
let tlsPort: number;

beforeAll(async () => {
	const pems = await selfsigned.generate(
		[
			{ name: 'commonName', value: 'localhost' },
			{ name: 'organizationName', value: 'Test CA Org' },
		],
		{
			keyType: 'ec',
			algorithm: 'sha256',
			notBeforeDate: notBefore,
			notAfterDate: notAfter,
			extensions: [
				{
					name: 'subjectAltName',
					altNames: [
						{ type: 2, value: 'localhost' },
						{ type: 2, value: 'www.localhost' },
						{ type: 7, ip: '127.0.0.1' },
					],
				},
			],
		},
	);
	certPem = pems.cert;

	tlsServer = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => socket.end());
	await new Promise<void>((resolve) => tlsServer.listen(0, '127.0.0.1', resolve));
	tlsPort = (tlsServer.address() as AddressInfo).port;
});

afterAll(async () => {
	await new Promise((resolve) => tlsServer.close(resolve));
});

async function expectCertFetchError(promise: Promise<unknown>, message: string) {
	const error = await promise.catch((error: unknown) => error);
	expect(error).toBeInstanceOf(CertFetchError);
	expect((error as CertFetchError).message).toBe(message);
}

describe('fetchCertificate', () => {
	it('reads the certificate details', async () => {
		const cert = await fetchCertificate('localhost', tlsPort, { allowNonPublicAddresses: true });

		expect(cert).toEqual({
			notBefore,
			notAfter,
			issuer: 'Test CA Org',
			cn: 'localhost',
			san: ['localhost', 'www.localhost'],
			serial: new X509Certificate(certPem).serialNumber,
			fingerprint256: new X509Certificate(certPem).fingerprint256,
			ip: '127.0.0.1',
		});
	});

	it('refuses to connect to non-public addresses by default', async () => {
		await expectCertFetchError(
			fetchCertificate('localhost', tlsPort),
			'DNS lookup returned no public IPv4 addresses',
		);
	});

	it('fails when the DNS lookup fails', async () => {
		await expectCertFetchError(
			fetchCertificate('does-not-exist.invalid', 443),
			'DNS lookup failed',
		);
	});

	it('fails when the connection is refused', async () => {
		// Grab a free port and release it, so nothing is listening there
		const server = net.createServer();
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;
		await new Promise((resolve) => server.close(resolve));

		await expectCertFetchError(
			fetchCertificate('localhost', port, { allowNonPublicAddresses: true }),
			'TLS connection failed',
		);
	});

	it('times out when the server never completes the handshake', async () => {
		const sockets = new Set<net.Socket>();
		const server = net.createServer((socket) => sockets.add(socket));
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;

		try {
			await expectCertFetchError(
				fetchCertificate('localhost', port, { allowNonPublicAddresses: true, timeoutMs: 300 }),
				'TLS connection timed out',
			);
		} finally {
			sockets.forEach((socket) => socket.destroy());
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
