import { Injectable } from "@nestjs/common";
import { Counter } from "prom-client";

@Injectable()
export class SecurityMetricsService {
  private readonly internalAuthFailures = new Counter({
    name: "security_internal_auth_failures_total",
    help: "Failed authentication attempts from internal service boundaries",
    labelNames: ["source"],
  });

  private readonly authorizationDenials = new Counter({
    name: "security_authorization_denials_total",
    help: "Authorization denials by boundary",
    labelNames: ["boundary"],
  });

  private readonly outboxFailures = new Counter({
    name: "outbox_delivery_failures_total",
    help: "Outbox delivery failures and dead-letter transitions",
    labelNames: ["status"],
  });

  recordInternalAuthFailure(source: string): void {
    this.internalAuthFailures.inc({ source });
  }

  recordAuthorizationDenial(boundary: string): void {
    this.authorizationDenials.inc({ boundary });
  }

  recordOutboxFailure(status: "failed" | "dead_letter"): void {
    this.outboxFailures.inc({ status });
  }
}
