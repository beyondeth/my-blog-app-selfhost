import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // If it's a public route, skip role checking
    if (isPublic) {
      return true;
    }
    
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      console.log('[RolesGuard] No user found in request');
      return false;
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    console.log(`[RolesGuard] User role: "${user.role}" (type: ${typeof user.role}), Required roles: ${JSON.stringify(requiredRoles)}, Has role: ${hasRole}`);

    return hasRole;
  }
} 