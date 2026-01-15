import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import * as dns from "dns";
import * as ipaddr from "ipaddr.js";

/**
 * 공용 URL 안전성 검사 서비스
 * - 프로토콜 보정
 * - Private/Loopback/Metadata IP 차단
 * - AWS/GCP 메타데이터 보호
 */
@Injectable()
export class UrlSafetyService {
  private readonly logger = new Logger(UrlSafetyService.name);

  normalizeUrl(url: string): string {
    let normalized = url.trim();

    if (
      !normalized.startsWith("http://") &&
      !normalized.startsWith("https://")
    ) {
      normalized = "https://" + normalized;
    }

    return normalized;
  }

  async normalizeAndValidate(url: string): Promise<string> {
    const normalized = this.normalizeUrl(url);
    await this.validateUrl(normalized);
    return normalized;
  }

  private async validateUrl(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      if (ipaddr.isValid(hostname)) {
        this.checkIpAddress(hostname);
        return;
      }

      const ips = await this.resolveHostname(hostname);

      if (ips.length === 0) {
        throw new BadRequestException("도메인을 찾을 수 없습니다.");
      }

      for (const ip of ips) {
        this.checkIpAddress(ip);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(`URL validation failed for ${url}: ${error.message}`);
      throw new BadRequestException(
        `유효하지 않거나 접근이 제한된 URL입니다: ${error.message}`,
      );
    }
  }

  private async resolveHostname(hostname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return reject(err);
        resolve(addresses.map((a) => a.address));
      });
    });
  }

  private checkIpAddress(ip: string): void {
    try {
      const parsedIp = ipaddr.parse(ip);
      const range = parsedIp.range();

      const blockedRanges = [
        "loopback",
        "private",
        "linkLocal",
        "unspecified",
        "broadcast",
      ];

      if (
        parsedIp.kind() === "ipv6" &&
        (parsedIp as ipaddr.IPv6).isIPv4MappedAddress()
      ) {
        const ipv4 = (parsedIp as ipaddr.IPv6).toIPv4Address();
        if (blockedRanges.includes(ipv4.range())) {
          throw new BadRequestException(
            `접근이 제한된 IP 대역입니다 (Internal/Private Endpoint): ${ip}`,
          );
        }
      }

      if (blockedRanges.includes(range)) {
        throw new BadRequestException(
          `접근이 제한된 IP 대역입니다 (Internal/Private Endpoint): ${ip}`,
        );
      }

      if (ip === "169.254.169.254") {
        throw new BadRequestException(
          "클라우드 메타데이터 서비스 접근이 차단되었습니다.",
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`유효하지 않은 IP 주소입니다: ${ip}`);
    }
  }
}
