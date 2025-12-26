import { randomBytes } from 'crypto';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateToken(length: number = 64): string {
	const bytes = randomBytes(length);
	let result = '';

	for (let i = 0; i < length; i++) {
		result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
	}

	return result;
}

export function createConfirmationToken(expiryDays: number = 7) {
	const token = generateToken();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiryDays);

	return { token, expiresAt };
}
