import crypto from "crypto";

export interface BlogInfo {
  id: string;
  name: string;
  slug: string;
  userId: string;
}

export class SecureAPIKeyAuth {
  public baseUrl: string;
  public apiUrl: string;
  private apiKeyId?: string;
  private apiKeySecret?: string;
  public accessToken?: string;
  public blogInfo?: BlogInfo;
  public userId?: string;
  public blogId?: string;
  private timestampWindow = 300; // 5 minutes
  private usedNonces = new Set<string>();

  constructor() {
    // BLOG_API_URL already includes /api/v1
    this.apiUrl = process.env["BLOG_API_URL"] || "http://localhost:3000/api/v1";
    this.baseUrl = this.apiUrl.replace(/\/api\/v1$/, '');

    // AWS-style API Key ID and Secret separation
    this.apiKeyId = process.env["BLOG_API_KEY_ID"];
    this.apiKeySecret = process.env["BLOG_API_KEY_SECRET"];

    // Legacy support: support old-style single API Key
    if (!this.apiKeyId || !this.apiKeySecret) {
      const legacyKey = process.env["BLOG_API_KEY"];
      if (legacyKey) {
        this.apiKeySecret = legacyKey;
        this.apiKeyId = this.extractKeyId(legacyKey);
      }
    }
  }

  private extractKeyId(apiKey: string): string {
    /** Extract ID from API Key (temporary: first 8 characters) */
    if (apiKey && apiKey.startsWith("sk_")) {
      return apiKey.substring(3, 11);
    }
    return "";
  }


  private validateTimestamp(timestamp: string): boolean {
    /** Validate timestamp (allow within 5 minutes) */
    try {
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - requestTime);
      return timeDiff <= this.timestampWindow * 1000;
    } catch {
      return false;
    }
  }

  private checkNonceReuse(nonce: string): boolean {
    /** Check nonce duplication (prevent replay attacks) */
    if (this.usedNonces.has(nonce)) {
      return false;
    }
    this.usedNonces.add(nonce);

    // Clean up old nonces (memory management)
    if (this.usedNonces.size > 1000) {
      this.usedNonces.clear();
    }

    return true;
  }

  public async authenticate(): Promise<boolean> {
    /**
     * AWS Signature V4 style enhanced security authentication
     * 
     * Security checklist:
     * ✓ API Secret is never transmitted
     * ✓ Uses HMAC-SHA256 signature
     * ✓ 5-minute timestamp limit
     * ✓ Nonce prevents replay
     * ✓ Full request signing prevents tampering
     */
    try {
      // 1. Check API Key ID and Secret
      if (!this.apiKeyId || !this.apiKeySecret) {
        console.error("❌ Security error: API Key ID or Secret not configured");
        return false;
      }

      // Validate format
      if (
        !this.apiKeySecret.startsWith("aks_") &&
        !this.apiKeySecret.startsWith("sk_")
      ) {
        console.error("❌ Security error: Invalid API Key Secret format");
        return false;
      }

      if (
        this.apiKeyId &&
        !this.apiKeyId.startsWith("akid_") &&
        !this.apiKeySecret.startsWith("sk_")
      ) {
        console.error("❌ Security error: Invalid API Key ID format");
        return false;
      }

      // 2. Generate security parameters
      const timestamp = Date.now().toString();
      const nonce = crypto.randomBytes(16).toString("hex");

      // 3. Validate timestamp
      if (!this.validateTimestamp(timestamp)) {
        console.error("❌ Security error: Timestamp validation failed");
        return false;
      }

      // 4. Check nonce duplication
      if (!this.checkNonceReuse(nonce)) {
        console.error("❌ Security error: Nonce reuse detected");
        return false;
      }

      // 5. Prepare authentication - Using secure AWS V4 style method
      const method = "POST";
      const uri = "/auth/verify-api-key-id-secret";

      // Secure method - NO secret in body
      const body = JSON.stringify({
        keyId: this.apiKeyId,
        timestamp,
        nonce,
      });

      // Generate AWS V4 style signature using unified method
      const signature = this.generateHmacSignature(method, uri, timestamp, nonce, body);

      // 6. Make API call with signature (AWS V4 style - no secret in body)
      const response = await fetch(`${this.apiUrl}/auth/verify-api-key-id-secret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key-ID": this.apiKeyId,
          "X-API-Signature": signature,
          "X-API-Timestamp": timestamp,
          "X-API-Nonce": nonce,
        },
        body,
      });

      // 7. Process response
      if (response.ok) {
        const data = await response.json() as any;
        if (data.valid) {
          this.userId = data.userId;
          this.blogId = data.blogId;
          this.accessToken = data.sessionToken;
          this.blogInfo = data.blog;

          console.log("✅ AWS V4 secure authentication successful (Secret never transmitted)");
          return true;
        } else {
          console.error("❌ Authentication failed: Signature verification failed");
        }
      } else {
        console.error(`❌ API authentication failed: HTTP ${response.status}`);
      }

      return false;
    } catch (error) {
      console.error(`❌ Authentication error: ${String(error).slice(0, 100)}`);
      return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature (unified method)
   * Used by both authentication and API client
   */
  public generateHmacSignature(
    method: string,
    uri: string,
    timestamp: string,
    nonce: string,
    body: string
  ): string {
    if (!this.apiKeyId || !this.apiKeySecret) {
      throw new Error("API key ID or secret not configured");
    }

    // 1. Create body hash
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");

    // 2. Create message to sign - MUST match backend exactly
    const message = [
      method,
      uri,
      this.apiKeyId,
      timestamp,
      nonce,
      bodyHash
    ].join(':');

    // 3. Generate HMAC signature with Secret
    const signature = crypto
      .createHmac("sha256", this.apiKeySecret)
      .update(message)
      .digest("hex");

    return signature;
  }

  public getApiKeyId(): string | undefined {
    return this.apiKeyId;
  }

  public getApiKeySecret(): string | undefined {
    return this.apiKeySecret;
  }
}