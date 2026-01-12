import { DomainStatus } from '$prisma/generated/enums';

const MS_PER_DAY = 86_400_000;

export function computeDomainStatus(notAfter: Date, now: Date): DomainStatus {
	const daysRemaining = Math.ceil((notAfter.getTime() - now.getTime()) / MS_PER_DAY);

	if (daysRemaining < 0) return DomainStatus.EXPIRED;
	if (daysRemaining <= 1) return DomainStatus.EXPIRING_1DAY;
	if (daysRemaining <= 7) return DomainStatus.EXPIRING_7DAYS;
	if (daysRemaining <= 14) return DomainStatus.EXPIRING_14DAYS;
	if (daysRemaining <= 30) return DomainStatus.EXPIRING_30DAYS;
	return DomainStatus.OK;
}
