import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { OAuthClient } from './oauth-client.entity';

/**
 * OAuth2 액세스 토큰 엔티티
 * 발급된 토큰 정보를 저장 (Redis와 병행 사용)
 */
@Entity('oauth_tokens')
@Index(['tokenHash'], { unique: true })
@Index(['userId'])
@Index(['blogId'])
@Index(['expiresAt'])
export class OAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 액세스 토큰 해시
   * 실제 토큰은 클라이언트에만 전달, DB에는 해시만 저장
   */
  @Column({ unique: true })
  tokenHash: string;

  /**
   * 리프레시 토큰 해시 (선택적)
   */
  @Column({ nullable: true })
  refreshTokenHash: string;

  /**
   * 토큰 타입
   * 'access' | 'refresh'
   */
  @Column({ default: 'access' })
  tokenType: string;

  /**
   * 토큰 소유자
   */
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * 토큰이 바인딩된 블로그
   * MCP는 특정 블로그에만 포스팅 가능
   */
  @Column()
  blogId: string;

  @ManyToOne(() => Blog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blogId' })
  blog: Blog;

  /**
   * 발급한 OAuth 클라이언트
   */
  @Column()
  clientId: string;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: OAuthClient;

  /**
   * 부여된 권한 스코프
   * MCP는 ['mcp:post:create']만 허용
   */
  @Column('simple-array')
  scopes: string[];

  /**
   * 토큰 만료 시간
   * 액세스 토큰: 1시간
   * 리프레시 토큰: 30일
   */
  @Column()
  expiresAt: Date;

  /**
   * 토큰 취소 여부
   */
  @Column({ default: false })
  isRevoked: boolean;

  /**
   * 토큰 취소 시간
   */
  @Column({ nullable: true })
  revokedAt: Date;

  /**
   * 토큰 취소 사유
   */
  @Column({ nullable: true })
  revokeReason: string;

  /**
   * 마지막 사용 시간
   */
  @Column({ nullable: true })
  lastUsedAt: Date;

  /**
   * 토큰 발급 시 IP 주소
   */
  @Column({ nullable: true })
  issuedIp: string;

  /**
   * 토큰 발급 시 User-Agent
   */
  @Column({ nullable: true, type: 'text' })
  issuedUserAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}