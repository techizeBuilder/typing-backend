import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../entities/user.entity';
import { PERMISSIONS_KEY, ROLES_KEY } from './roles.decorator';

export const isFullAdmin = (role?: string) => role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
export const hasModule = (user: any, module: string) => isFullAdmin(user?.role) || (user?.role === UserRole.SUBADMIN && (user.permissions || []).includes(module));

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, targets);
    const modules = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets);
    if (!requiredRoles && !modules) {
      return true;
    }
    // request.user is set by JwtStrategy.validate() with the role from the database.
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (requiredRoles && !requiredRoles.some((role) => user.role === role)) return false;
    if (modules && user.role === UserRole.SUBADMIN) return modules.some((m) => (user.permissions || []).includes(m));
    return true;
  }
}
