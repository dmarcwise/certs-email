import { db } from '#lib/server/db.ts';
import { generateToken } from '#lib/server/utils.ts';
import { DomainStatus } from '#prisma/generated/enums.ts';
import type { Prisma } from '#prisma/generated/client.ts';

export const DAY_MS = 86_400_000;

export function daysFromNow(days: number) {
	return new Date(Date.now() + days * DAY_MS);
}

export async function createUser(data: Partial<Prisma.UserCreateInput> = {}) {
	return db.user.create({
		data: {
			email: `user-${generateToken(8)}@example.com`,
			confirmed: true,
			settingsToken: generateToken(),
			sendHeartbeatReport: true,
			sendCertChangeAlerts: true,
			...data,
		},
	});
}

export async function createDomain(
	userId: number,
	data: Partial<Omit<Prisma.DomainUncheckedCreateInput, 'userId'>> = {},
) {
	return db.domain.create({
		data: {
			userId,
			name: `${generateToken(8).toLowerCase()}.example.com`,
			confirmed: true,
			status: DomainStatus.PENDING,
			...data,
		},
	});
}

export async function getOutbox() {
	return db.emailOutbox.findMany({ orderBy: { id: 'asc' } });
}
