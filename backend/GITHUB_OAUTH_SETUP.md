# GitHub OAuth Setup Guide

## Setting up GitHub OAuth App

1. **Go to GitHub Developer Settings**
   - Navigate to: https://github.com/settings/developers
   - Or: Settings → Developer settings → OAuth Apps

2. **Create New OAuth App**
   - Click "New OAuth App"
   - Fill in the following:
     - **Application name**: My Blog App (or your app name)
     - **Homepage URL**: http://localhost:3001
     - **Authorization callback URL**: http://localhost:3000/api/v1/auth/github/callback
   - Click "Register application"

3. **Get Your Credentials**
   - After creating the app, you'll see:
     - **Client ID**: Copy this value
     - **Client Secret**: Click "Generate a new client secret" and copy the value

4. **Update .env File**
   ```bash
   GITHUB_CLIENT_ID=your-actual-client-id-here
   GITHUB_CLIENT_SECRET=your-actual-client-secret-here
   GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/github/callback
   ```

## Production Setup

For production, update the URLs:
- **Homepage URL**: https://yourdomain.com
- **Authorization callback URL**: https://yourdomain.com/api/v1/auth/github/callback

## Testing

After setting up the credentials:
1. Restart the backend server: `pnpm start:dev`
2. Navigate to http://localhost:3001/login
3. Click "GitHub로 로그인" button
4. You should be redirected to GitHub for authorization
5. After authorization, you'll be redirected back and logged in

## Troubleshooting

- **Error: OAuth2Strategy requires a clientID option**
  - Make sure GITHUB_CLIENT_ID is set in .env file
  
- **Error: Redirect URI mismatch**
  - Ensure the callback URL in GitHub settings exactly matches GITHUB_CALLBACK_URL in .env

- **Error: Failed to obtain access token**
  - Check that GITHUB_CLIENT_SECRET is correct
  - Regenerate the secret if needed