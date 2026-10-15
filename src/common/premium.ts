import { User, UserRole } from '../entities/user.entity';

// "Premium" = staff, or a student whose validity end date has not passed yet.
// The validity end is what the admin sets on a student and what activating a
// plan sets, so content gates and plans share one rule.
export function hasPremiumAccess(user: Pick<User, 'role' | 'validity_end'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== UserRole.STUDENT) return true;
  if (!user.validity_end) return false;
  const end = new Date(user.validity_end);
  end.setHours(23, 59, 59, 999);
  return new Date() <= end;
}
