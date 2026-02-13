import { Injectable, Logger } from "@nestjs/common";
import {
  PaymentProvider,
  CreateCustomerOptions,
  CreateCheckoutSessionOptions,
  CheckoutSessionResponse,
  CreateSubscriptionOptions,
  SubscriptionResponse,
  PaymentMethod,
  WebhookEvent,
} from "../interfaces/payment-provider.interface";
import { v4 as uuidv4 } from "uuid";

/**
 * 개발/테스트용 Mock Payment Provider
 * 실제 결제 없이 시스템을 테스트할 수 있도록 하는 모의 구현
 */
@Injectable()
export class MockProvider implements PaymentProvider {
  private readonly logger = new Logger(MockProvider.name);
  private mockDatabase = {
    customers: new Map<string, any>(),
    subscriptions: new Map<string, any>(),
    paymentMethods: new Map<string, PaymentMethod>(),
    invoices: new Map<string, any>(),
  };

  getName(): string {
    return "mock";
  }

  async createCustomer(options: CreateCustomerOptions): Promise<string> {
    const customerId = `cus_mock_${uuidv4()}`;

    this.mockDatabase.customers.set(customerId, {
      id: customerId,
      email: options.email,
      name: options.name,
      metadata: options.metadata,
      created: new Date(),
    });

    this.logger.debug(`[MockProvider] Customer created: ${customerId}`);
    return customerId;
  }

  async getCustomer(customerId: string): Promise<any> {
    const customer = this.mockDatabase.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    return customer;
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerOptions>,
  ): Promise<void> {
    const customer = await this.getCustomer(customerId);
    Object.assign(customer, updates);
    this.mockDatabase.customers.set(customerId, customer);
    this.logger.debug(`[MockProvider] Customer updated: ${customerId}`);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    this.mockDatabase.customers.delete(customerId);
    this.logger.debug(`[MockProvider] Customer deleted: ${customerId}`);
  }

  async createCheckoutSession(
    options: CreateCheckoutSessionOptions,
  ): Promise<CheckoutSessionResponse> {
    const sessionId = `cs_mock_${uuidv4()}`;
    const customerId = options.customerId || `cus_mock_${uuidv4()}`;

    // Mock checkout URL - 실제로는 결제 페이지로 이동
    const checkoutUrl = `http://localhost:3001/mock-checkout?session=${sessionId}`;

    this.logger.debug(`[MockProvider] Checkout session created: ${sessionId}`);
    this.logger.debug(
      `[MockProvider] Amount: ${options.priceAmount} ${options.currency}`,
    );
    this.logger.debug(`[MockProvider] Product: ${options.productName}`);

    return {
      id: sessionId,
      url: checkoutUrl,
      status: "open",
      customerId,
      subscriptionId: `sub_mock_${uuidv4()}`,
    };
  }

  async createSubscription(
    options: CreateSubscriptionOptions,
  ): Promise<SubscriptionResponse> {
    const subscriptionId = `sub_mock_${uuidv4()}`;

    const subscription = {
      id: subscriptionId,
      customerId: options.customerId,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
      metadata: options.metadata,
      created: new Date(),
    };

    this.mockDatabase.subscriptions.set(subscriptionId, subscription);
    this.logger.debug(`[MockProvider] Subscription created: ${subscriptionId}`);

    return subscription;
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    const subscription = this.mockDatabase.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    return subscription;
  }

  async updateSubscription(
    subscriptionId: string,
    updates: any,
  ): Promise<SubscriptionResponse> {
    const subscription = await this.getSubscription(subscriptionId);
    Object.assign(subscription, updates);
    this.mockDatabase.subscriptions.set(subscriptionId, subscription);
    this.logger.debug(`[MockProvider] Subscription updated: ${subscriptionId}`);
    return subscription;
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);

    if (immediately) {
      subscription.status = "canceled";
      subscription.cancelAt = new Date();
    } else {
      subscription.status = "active";
      subscription.cancelAt = subscription.currentPeriodEnd;
    }

    this.mockDatabase.subscriptions.set(subscriptionId, subscription);
    this.logger.debug(
      `[MockProvider] Subscription canceled: ${subscriptionId}`,
    );
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    subscription.status = "active";
    subscription.cancelAt = null;
    this.mockDatabase.subscriptions.set(subscriptionId, subscription);
    this.logger.debug(`[MockProvider] Subscription resumed: ${subscriptionId}`);
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    // Mock 결제 수단 반환
    return [
      {
        id: `pm_mock_${uuidv4()}`,
        type: "card",
        last4: "4242",
        brand: "visa",
        expiryMonth: 12,
        expiryYear: 2025,
      },
    ];
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    this.logger.debug(
      `[MockProvider] Default payment method set: ${paymentMethodId} for ${customerId}`,
    );
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    this.mockDatabase.paymentMethods.delete(paymentMethodId);
    this.logger.debug(
      `[MockProvider] Payment method deleted: ${paymentMethodId}`,
    );
  }

  async listInvoices(customerId: string, limit = 10): Promise<any[]> {
    // Mock 인보이스 반환
    return [
      {
        id: `inv_mock_${uuidv4()}`,
        customerId,
        amount: 900, // $9.00
        currency: "usd",
        status: "paid",
        created: new Date(),
      },
    ];
  }

  async createRefund(paymentIntentId: string, amount?: number): Promise<any> {
    const refundId = `re_mock_${uuidv4()}`;
    this.logger.debug(
      `[MockProvider] Refund created: ${refundId} for ${paymentIntentId}`,
    );

    return {
      id: refundId,
      amount: amount || 0,
      status: "succeeded",
      created: new Date(),
    };
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    // Mock에서는 항상 true 반환
    return true;
  }

  parseWebhookEvent(payload: any): WebhookEvent {
    return {
      id: `evt_mock_${uuidv4()}`,
      type: payload.type || "mock.event",
      data: payload.data || {},
      created: new Date(),
    };
  }
}
