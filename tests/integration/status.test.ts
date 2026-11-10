import { describe, expect, it } from 'vitest';
import { computeDomainStatus } from '#lib/server/status.ts';
import { DomainStatus } from '#prisma/generated/enums.ts';

const now = new Date('2026-11-10T12:00:00Z');
const DAY_MS = 86_400_000;

describe('computeDomainStatus', () => {
	it.each([
		{ days: 31, status: DomainStatus.OK },
		{ days: 30.5, status: DomainStatus.OK },
		{ days: 30, status: DomainStatus.EXPIRING_30DAYS },
		{ days: 15, status: DomainStatus.EXPIRING_30DAYS },
		{ days: 14, status: DomainStatus.EXPIRING_14DAYS },
		{ days: 8, status: DomainStatus.EXPIRING_14DAYS },
		{ days: 7, status: DomainStatus.EXPIRING_7DAYS },
		{ days: 2, status: DomainStatus.EXPIRING_7DAYS },
		{ days: 1, status: DomainStatus.EXPIRING_1DAY },
		{ days: 0.01, status: DomainStatus.EXPIRING_1DAY },
		{ days: -0.5, status: DomainStatus.EXPIRING_1DAY },
		{ days: -1, status: DomainStatus.EXPIRED },
		{ days: -30, status: DomainStatus.EXPIRED },
	])('returns $status with $days days left', ({ days, status }) => {
		expect(computeDomainStatus(new Date(now.getTime() + days * DAY_MS), now)).toBe(status);
	});
});
