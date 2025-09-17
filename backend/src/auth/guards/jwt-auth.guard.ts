import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log('[JwtAuthGuard] Checking authentication for:', request.url);
    console.log('[JwtAuthGuard] Cookies present:', Object.keys(request.cookies || {}));
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log('[JwtAuthGuard] handleRequest - User:', user?.id, 'Error:', err?.message, 'Info:', info?.message);

    if (err || !user) {
      console.log('[JwtAuthGuard] Authentication failed for:', request.url);
      throw err || new UnauthorizedException('Authentication required');
    }
    console.log('[JwtAuthGuard] Authentication successful for user:', user.id);
    return user;
  }
} 