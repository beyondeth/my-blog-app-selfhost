import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * IP 보안 서비스
 * 
 * 개인정보보호법 및 GDPR 준수를 위한 IP 주소 보안 처리
 * 
 * 기능:
 * - AES-256-GCM 암호화/복호화
 * - IP 마스킹 (192.168.1.*** 형태)
 * - 해싱 (중복 탐지용)
 * 
 * 환경변수:
 * - IP_ENCRYPTION_KEY: 32바이트 암호화 키 (필수)
 * - IP_ENCRYPTION_SALT: 해싱용 솔트 (선택)
 */
@Injectable()
export class IpSecurityService {
  private readonly logger = new Logger(IpSecurityService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16;

  private readonly encryptionKey: Buffer;
  private readonly salt: string;

  constructor() {
    // 환경변수에서 키 로드 (없으면 개발용 기본값)
    const keyEnv = process.env.IP_ENCRYPTION_KEY;
    
    if (!keyEnv) {
      this.logger.warn(
        '⚠️ IP_ENCRYPTION_KEY not set! Using development key. DO NOT use in production!'
      );
      // 개발용 기본 키 (32 bytes)
      this.encryptionKey = crypto.scryptSync('dev-key-do-not-use-in-prod', 'salt', this.keyLength);
    } else {
      // 프로덕션 키 (Base64 또는 Hex 형식)
      this.encryptionKey = Buffer.from(keyEnv, 'base64');
      if (this.encryptionKey.length !== this.keyLength) {
        throw new Error(`IP_ENCRYPTION_KEY must be ${this.keyLength} bytes (256 bits)`);
      }
    }

    this.salt = process.env.IP_ENCRYPTION_SALT || 'ip-security-salt-v1';
  }

  /**
   * IP 주소 암호화
   * 
   * @param ip 원본 IP 주소
   * @returns 암호화된 문자열 (IV:AuthTag:CipherText, Base64)
   */
  encrypt(ip: string | null | undefined): string | null {
    if (!ip) return null;

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(ip, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      // 형식: IV:AuthTag:EncryptedData (모두 Base64)
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      this.logger.error(`Failed to encrypt IP: ${error.message}`);
      return null;
    }
  }

  /**
   * IP 주소 복호화
   * 
   * @param encryptedIp 암호화된 IP 문자열
   * @returns 원본 IP 주소
   */
  decrypt(encryptedIp: string | null | undefined): string | null {
    if (!encryptedIp) return null;

    try {
      const parts = encryptedIp.split(':');
      if (parts.length !== 3) {
        // 암호화되지 않은 레거시 데이터일 수 있음
        this.logger.debug('Possibly unencrypted IP data, returning as-is');
        return encryptedIp;
      }

      const [ivBase64, authTagBase64, encrypted] = parts;
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Failed to decrypt IP: ${error.message}`);
      return null;
    }
  }

  /**
   * IP 주소 마스킹 (표시용)
   * 
   * 예시:
   * - IPv4: 192.168.1.100 → 192.168.1.***
   * - IPv6: 2001:db8::1 → 2001:db8::***
   * 
   * @param ip 원본 또는 암호화된 IP
   * @param isEncrypted IP가 암호화되어 있는지 여부
   * @returns 마스킹된 IP
   */
  mask(ip: string | null | undefined, isEncrypted = false): string {
    if (!ip) return 'N/A';

    try {
      const rawIp = isEncrypted ? this.decrypt(ip) : ip;
      if (!rawIp) return 'N/A';

      // IPv4
      if (rawIp.includes('.')) {
        const parts = rawIp.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.${'***'}`;
        }
      }

      // IPv6
      if (rawIp.includes(':')) {
        const parts = rawIp.split(':');
        if (parts.length >= 2) {
          return `${parts.slice(0, -1).join(':')}:***`;
        }
      }

      // 알 수 없는 형식
      return `${rawIp.substring(0, Math.max(rawIp.length - 3, 1))}***`;
    } catch (error) {
      this.logger.error(`Failed to mask IP: ${error.message}`);
      return 'Error';
    }
  }

  /**
   * IP 주소 해싱 (중복 탐지용)
   * 
   * 동일 IP 여부 비교에 사용 (원본 복구 불가)
   * 
   * @param ip 원본 IP 주소
   * @returns SHA-256 해시
   */
  hash(ip: string | null | undefined): string | null {
    if (!ip) return null;

    try {
      return crypto
        .createHmac('sha256', this.salt)
        .update(ip)
        .digest('hex');
    } catch (error) {
      this.logger.error(`Failed to hash IP: ${error.message}`);
      return null;
    }
  }

  /**
   * 두 IP가 동일한지 비교 (해시 기반)
   * 
   * @param ip1 첫 번째 IP
   * @param ip2 두 번째 IP
   * @returns 동일 여부
   */
  isSameIp(ip1: string | null, ip2: string | null): boolean {
    if (!ip1 || !ip2) return false;
    return this.hash(ip1) === this.hash(ip2);
  }

  /**
   * 테스트용: 키가 올바르게 설정되었는지 확인
   */
  testEncryption(): boolean {
    const testIp = '192.168.1.100';
    const encrypted = this.encrypt(testIp);
    if (!encrypted) return false;
    
    const decrypted = this.decrypt(encrypted);
    return decrypted === testIp;
  }
}
