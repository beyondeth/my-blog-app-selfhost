import { IncomingMessage } from "http";

export function getClientIp(req: IncomingMessage): string | undefined {
  /** Extract client IP address from request headers */
  // Check both possible header casings
  const forwardedFor = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (!ips) return undefined;
    const ipList = ips.split(",").map((ip) => ip.trim());

    // Find the first public IP address
    for (const ip of ipList) {
      const plainIp = ip.replace(/^::ffff:/, "");
      if (
        !plainIp.startsWith("10.") &&
        !plainIp.startsWith("192.168.") &&
        !/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(plainIp)
      ) {
        return plainIp;
      }
    }
    // If all are private, use the first one
    return ipList[0]?.replace(/^::ffff:/, "");
  }

  // Fallback: use remote address, strip IPv6-mapped IPv4
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress.replace(/^::ffff:/, "");
  }
  return undefined;
}

export function delay(ms: number): Promise<void> {
  /** Simple delay utility */
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeString(str: string): string {
  /** Sanitize string for safe output */
  return str.replace(/[<>]/g, "").trim();
}

export function truncateString(str: string, maxLength: number): string {
  /** Truncate string with ellipsis */
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}