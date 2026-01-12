import tls, { type PeerCertificate } from 'node:tls';

const DEFAULT_TIMEOUT_MS = 10_000;

export class CertFetchError extends Error {
	cause?: unknown;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'CertFetchError';
		this.cause = cause;
	}
}

export interface CertificateInfo {
	notBefore: Date;
	notAfter: Date;
	issuer: string | null;
	cn: string | null;
	san: string[];
	serial: string | null;
	fingerprint256: string | null;
	ip: string | null;
}

function parseSan(subjectAltName: string | undefined): string[] {
	if (!subjectAltName) return [];

	return subjectAltName
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.toLowerCase().startsWith('dns:'))
		.map((entry) => entry.slice(4).trim())
		.filter(Boolean);
}

export async function fetchCertificate(
	hostname: string,
	port: number,
	timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<CertificateInfo> {
	return new Promise((resolve, reject) => {
		let settled = false;

		const resolveOnce = (value: CertificateInfo) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		const rejectOnce = (error: Error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};

		const socket = tls.connect(
			{
				host: hostname,
				port,
				servername: hostname
			},
			() => {
				let cert: PeerCertificate | undefined;
				const remoteAddress = socket.remoteAddress;
				try {
					cert = socket.getPeerCertificate(false);
				} catch (err) {
					rejectOnce(new CertFetchError('Failed to read certificate', err));
				} finally {
					socket.end();
				}

				if (!cert || !cert.valid_from || !cert.valid_to) {
					rejectOnce(new CertFetchError('No certificate received'));
					return;
				}

				resolveOnce({
					notBefore: new Date(cert.valid_from),
					notAfter: new Date(cert.valid_to),
					issuer: (cert.issuer.O ?? cert.issuer.CN) || null,
					cn: cert.subject.CN || null,
					san: parseSan(cert.subjectaltname),
					serial: cert.serialNumber || null,
					fingerprint256: cert.fingerprint256 || null,
					ip: remoteAddress ?? null
				});
			}
		);

		socket.setTimeout(timeoutMs, () => {
			rejectOnce(new CertFetchError('TLS connection timed out'));
			socket.destroy();
		});

		socket.once('error', (error) => {
			rejectOnce(new CertFetchError('TLS connection failed', error));
		});
	});
}
