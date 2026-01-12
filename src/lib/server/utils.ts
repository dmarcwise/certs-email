import { randomBytes } from 'crypto';
import { DomainStatus } from '$prisma/generated/enums';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateToken(length: number = 64): string {
	const bytes = randomBytes(length);
	let result = '';

	for (let i = 0; i < length; i++) {
		result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
	}

	return result;
}

export function createConfirmationToken(expirationDays: number = 7) {
	const token = generateToken();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expirationDays);

	return { token, expiresAt };
}

export function formatExpirationDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function formatExpiresIn(daysRemaining: number, status: DomainStatus): string {
	if (status === DomainStatus.EXPIRED) return 'expired';
	if (daysRemaining <= 0) return 'expires today';
	if (daysRemaining === 1) return 'in 1 day';
	return `in ${daysRemaining} days`;
}
