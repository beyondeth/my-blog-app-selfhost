import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Conversation } from "../../chat/entities/conversation.entity";
import { Message } from "../../chat/entities/message.entity";
import { Order } from "../entities/order.entity";
import { Post } from "../../posts/entities/post.entity";
import { ProductDetail } from "../entities/product-detail.entity";

/**
 * 거래 채팅 서비스
 *
 * 마켓플레이스 주문에 연결된 transaction 타입 대화 관리.
 * 기존 ChatService 인프라(WebSocket, 배치 저장) 위에 거래 전용 규칙 추가.
 *
 * 규칙:
 *   - 주문당 1개 대화 (UNIQUE orderId)
 *   - 메시지 삭제 불가 (ChatService.deleteMessage에서 가드)
 *   - 90일 보관
 *   - 관리자 열람 가능 (분쟁 해결)
 *   - 주문/환불 상태 변경 시 시스템 메시지 자동 전송
 */
@Injectable()
export class TransactionChatService {
  private readonly logger = new Logger(TransactionChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(ProductDetail)
    private readonly productDetailRepository: Repository<ProductDetail>,
  ) {}

  /**
   * 구매 확인 시 거래 대화 자동 생성
   * 구매자-판매자 간 transaction 대화 + 초기 시스템 메시지
   */
  async onPurchaseConfirmed(
    orderId: string,
    buyerId: string,
    sellerId: string,
    productPostId: string,
  ): Promise<Conversation> {
    // 이미 존재하는 거래 대화 확인 (멱등성)
    const existing = await this.conversationRepository.findOne({
      where: { orderId },
    });
    if (existing) return existing;

    // user1Id < user2Id 순서 보장 (기존 DM 패턴과 동일)
    const [user1Id, user2Id] =
      buyerId < sellerId ? [buyerId, sellerId] : [sellerId, buyerId];

    const conversation = this.conversationRepository.create({
      user1Id,
      user2Id,
      type: "transaction",
      orderId,
      productPostId,
      retentionDays: 90,
      isAdminViewable: true,
      lastMessageAt: new Date(),
    });

    const saved = await this.conversationRepository.save(conversation);

    // 초기 시스템 메시지
    await this.sendSystemMessage(
      saved.id,
      "SYSTEM",
      "구매가 완료되었습니다. 판매자와 자유롭게 대화하세요.",
    );

    this.logger.log(
      `거래 대화 생성: conversationId=${saved.id}, orderId=${orderId}`,
    );

    return saved;
  }

  /**
   * 시스템 메시지 전송 (주문 상태 변경, 환불 알림 등)
   */
  async sendSystemMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      conversationId,
      senderId,
      content,
      messageType: "system",
    });

    return this.messageRepository.save(message);
  }

  /**
   * 거래 대화의 상품/주문 컨텍스트 조회 (프론트엔드 상단 카드용)
   */
  async getTransactionContext(conversationId: string): Promise<{
    product: {
      title: string;
      slug: string;
      price: number;
      thumbnailImageId: string | null;
    };
    order: {
      orderId: string;
      status: string;
      amount: number;
      createdAt: Date;
    };
    refundStatus?: string;
  } | null> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, type: "transaction" },
    });

    if (!conversation?.orderId || !conversation?.productPostId) {
      return null;
    }

    const [order, post] = await Promise.all([
      this.orderRepository.findOne({
        where: { orderId: conversation.orderId },
      }),
      this.postRepository.findOne({
        where: { id: conversation.productPostId },
        select: ["id", "title", "slug", "thumbnailImageId"],
      }),
    ]);

    if (!order || !post) return null;

    const productDetail = await this.productDetailRepository.findOne({
      where: { postId: post.id },
      select: ["price"],
    });

    return {
      product: {
        title: post.title,
        slug: post.slug,
        price: productDetail?.price || order.amount,
        thumbnailImageId: post.thumbnailImageId || null,
      },
      order: {
        orderId: order.orderId,
        status: order.status,
        amount: order.amount,
        createdAt: order.createdAt,
      },
    };
  }

  /**
   * 주문 ID로 거래 대화 조회
   */
  async getConversationByOrderId(
    orderId: string,
  ): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { orderId, type: "transaction" },
    });
  }

  /**
   * 주문 상태 변경 시 시스템 메시지
   */
  async notifyOrderStatusChange(
    orderId: string,
    newStatus: string,
  ): Promise<void> {
    const conversation = await this.getConversationByOrderId(orderId);
    if (!conversation) return;

    const statusMessages: Record<string, string> = {
      refunded: "환불이 완료되었습니다.",
      cancelled: "주문이 취소되었습니다.",
    };

    const message = statusMessages[newStatus];
    if (message) {
      await this.sendSystemMessage(conversation.id, "SYSTEM", message);
    }
  }
}
