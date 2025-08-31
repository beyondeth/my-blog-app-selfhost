import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Get the request object
    const request = context.switchToHttp().getRequest();
    
    // Log for debugging
    console.log('[OptionalJwtAuthGuard] Checking for authentication');
    console.log('[OptionalJwtAuthGuard] Cookies:', request.cookies ? Object.keys(request.cookies) : 'No cookies');
    
    // Try to authenticate
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Log the authentication result
    console.log('[OptionalJwtAuthGuard] Authentication result:', {
      error: err ? err.message : null,
      user: user ? user.id : null,
      info: info ? info.message : null
    });
    
    // Don't throw error if authentication fails
    // Just return null user which will be available in the request
    if (err || !user) {
      console.log('[OptionalJwtAuthGuard] No valid authentication, proceeding without user');
      return null;
    }
    
    console.log(`[OptionalJwtAuthGuard] User authenticated: ${user.id}`);
    return user;
  }
}