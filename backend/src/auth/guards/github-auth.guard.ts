import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GitHubAuthGuard extends AuthGuard('github') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if GitHub OAuth is configured
    const clientId = this.configService.get('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get('GITHUB_CLIENT_SECRET');
    
    if (!clientId || !clientSecret || 
        clientId === 'your-github-client-id' || 
        clientId === 'dummy-client-id') {
      // If not configured, don't use the guard
      // The controller will handle the error response
      return false;
    }
    
    return super.canActivate(context);
  }
}