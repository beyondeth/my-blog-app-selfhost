import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[JwtAuthGuard] Checking authentication for:', request.url);
    }
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[JwtAuthGuard] handleRequest - User:', user?.id, 'Error:', err?.message, 'Info:', info?.message);
    }

    if (err || !user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[JwtAuthGuard] Authentication failed for:', request.url);
      }
      throw err || new UnauthorizedException('Authentication required');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[JwtAuthGuard] Authentication successful for user:', user.id);
    }
    return user;
  }
} 