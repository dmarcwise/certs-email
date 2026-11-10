import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface SentEmail {
	token: string | undefined;
	from: string;
	to: string[];
	subject: string;
	html?: string | null;
	text?: string | null;
	tag?: string | null;
}

/**
 * A minimal fake of the Lettermint API that records the emails sent through the real SDK.
 *
 * Point the SDK to `baseUrl` (via the `LETTERMINT_BASE_URL` env variable).
 * Sent emails are also exposed at `GET /__emails` for tests running in other processes.
 */
export class FakeLettermint {
	readonly emails: SentEmail[] = [];
	/** When set, `POST /v1/send` responds with this HTTP status instead of accepting the email */
	failWithStatus: number | null = null;

	#server = http.createServer((req, res) => this.#handle(req, res));

	get baseUrl() {
		const { port } = this.#server.address() as AddressInfo;
		return `http://127.0.0.1:${port}/v1`;
	}

	get emailsUrl() {
		const { port } = this.#server.address() as AddressInfo;
		return `http://127.0.0.1:${port}/__emails`;
	}

	async start(port = 0) {
		await new Promise<void>((resolve) => this.#server.listen(port, '127.0.0.1', resolve));
		return this;
	}

	async stop() {
		this.#server.closeAllConnections();
		await new Promise<void>((resolve, reject) =>
			this.#server.close((error) => (error ? reject(error) : resolve())),
		);
	}

	reset() {
		this.emails.length = 0;
		this.failWithStatus = null;
	}

	async #handle(req: http.IncomingMessage, res: http.ServerResponse) {
		const json = (status: number, body: unknown) => {
			res.writeHead(status, { 'content-type': 'application/json' });
			res.end(JSON.stringify(body));
		};

		if (req.method === 'GET' && req.url === '/__emails') {
			return json(200, this.emails);
		}

		if (req.method === 'POST' && req.url === '/v1/send') {
			let raw = '';
			for await (const chunk of req) raw += chunk;

			if (this.failWithStatus !== null) {
				return json(this.failWithStatus, { message: 'Simulated failure' });
			}

			const body = JSON.parse(raw);
			const token = req.headers['x-lettermint-token'];
			this.emails.push({ ...body, token: Array.isArray(token) ? token[0] : token });

			return json(202, { message_id: `msg_${this.emails.length}`, status: 'pending' });
		}

		json(404, { message: 'Not found' });
	}
}
