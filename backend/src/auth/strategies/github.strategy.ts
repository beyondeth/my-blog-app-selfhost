import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-github2";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get("GITHUB_CLIENT_ID");
    const clientSecret = configService.get("GITHUB_CLIENT_SECRET");

    // Use dummy values if not configured to prevent startup errors
    super({
      clientID: clientID || "dummy-client-id",
      clientSecret: clientSecret || "dummy-client-secret",
      callbackURL:
        configService.get("GITHUB_CALLBACK_URL") ||
        "http://localhost:3000/api/v1/auth/github/callback",
      scope: ["user:email"], // Request email scope to get user's email
    });

    // Store whether GitHub OAuth is properly configured
    this.isConfigured = !!(
      clientID &&
      clientSecret &&
      clientID !== "your-github-client-id"
    );
  }

  private isConfigured: boolean;

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    // Check if GitHub OAuth is properly configured
    if (!this.isConfigured) {
      throw new Error("GitHub OAuth is not configured");
    }

    // GitHub profile structure
    const githubProfile = {
      id: profile.id,
      username: profile.username || profile.login,
      displayName: profile.displayName || profile.name,
      emails: profile.emails || [],
      photos: profile.photos || [],
      profileUrl: profile.profileUrl || profile.html_url,
      provider: "github",
      _raw: profile._raw,
      _json: profile._json,
    };

    // Get primary email (GitHub may return multiple emails)
    const primaryEmail =
      githubProfile.emails.find((email: any) => email.primary)?.value ||
      githubProfile.emails[0]?.value ||
      githubProfile._json?.email;

    // Create a unified profile object
    const userProfile = {
      id: githubProfile.id,
      email: primaryEmail,
      username: githubProfile.username,
      displayName: githubProfile.displayName,
      profileImage:
        githubProfile.photos[0]?.value || githubProfile._json?.avatar_url,
      provider: "github",
      emails: githubProfile.emails,
      photos: githubProfile.photos,
      profileUrl: githubProfile.profileUrl,
      bio: githubProfile._json?.bio,
      company: githubProfile._json?.company,
      location: githubProfile._json?.location,
    };

    // Validate with AuthService
    const authResponse = await this.authService.validateOAuthUser(
      userProfile,
      "github" as any,
    );

    return authResponse;
  }
}
