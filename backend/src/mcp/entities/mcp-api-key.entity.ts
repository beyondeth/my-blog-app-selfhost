import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Blog } from "../../blogs/entities/blog.entity";

/**
 * MCP API Key 엔티티
 *
 * Stripe 스타일 API Key 관리:
 * - keyHint: 공개 가능한 식별자 (8자, 예: "a1b2c3d4")
 * - keyHash: bcrypt 해시된 전체 키
 * - 형식: blog_sk_{hint}_{secret}
 *
 * 정책:
 * - 사용자당 최대 3개
 * - 90일 자동 만료
 * - 사용자 기반 Rate Limiting (200req/h)
 */
@Entity("mcp_api_keys")
@Index(["userId", "isActive"]) // 사용자별 활성 키 조회 최적화
export class McpApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * API Key Hint (공개 가능, 8자)
   * 예: "a1b2c3d4"
   *
   * 용도:
   * - DB 조회 최적화 (O(1))
   * - 키 목록에서 식별 (blog_sk_a1b2c3d4_***)
   */
  @Column({ unique: true, length: 8 })
  @Index()
  keyHint: string;

  /**
   * bcrypt 해시된 전체 API Key
   * 원본: blog_sk_a1b2c3d4_xyz123...
   */
  @Column()
  keyHash: string;

  /**
   * 서버 암호화된 전체 API Key (AES-256-GCM)
   * 복사/재표시를 위한 원문 보관용
   */
  @Column({ type: "text", nullable: true, select: false })
  encryptedApiKey: string | null;

  /**
   * 사용자 지정 키 이름
   * 예: "My MCP Key", "Production Key"
   */
  @Column()
  name: string;

  /**
   * 소유자 (User)
   */
  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  /**
   * 연결된 블로그
   */
  @Column({ type: "uuid" })
  blogId: string;

  @ManyToOne(() => Blog, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blogId" })
  blog: Blog;

  /**
   * 활성 상태
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * 마지막 사용 시간
   * Rate Limiting에 사용
   */
  @Column({ type: "timestamptz", nullable: true })
  lastUsedAt: Date | null;

  /**
   * 총 요청 수 (통계)
   */
  @Column({ type: "int", default: 0 })
  requestCount: number;

  /**
   * 생성된 포스트 수 (통계)
   */
  @Column({ type: "int", default: 0 })
  postsCreated: number;

  /**
   * 만료 시간 (90일 후)
   * 생성 시 자동 설정
   */
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
