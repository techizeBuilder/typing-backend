import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Sub-Admins also need one of these module permissions (the ids ticked on the
// Staff Management form). Admins and Super Admins are not limited by it.
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...modules: string[]) => SetMetadata(PERMISSIONS_KEY, modules);
