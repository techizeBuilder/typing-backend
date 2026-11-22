import { User, UserRole } from '../entities/user.entity';
import { validityEnded } from './zoned-time';

// "Premium" = staff, or a student whose validity end date has not passed yet.
// The validity end is what the admin sets on a student and what activating a
// plan sets, so content gates and plans share one rule.
export function hasPremiumAccess(user: Pick<User, 'role' | 'validity_end'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== UserRole.STUDENT) return true;
  if (!user.validity_end) return false;
  return !validityEnded(user.validity_end);
}
