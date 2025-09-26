import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * OAuth2 클라이언트 엔티티
 * MCP 클라이언트 등록 정보를 저장
 */
@Entity('oauth_clients')
@Index(['clientId'], { unique: true })
@Index(['userId'])
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 클라이언트 고유 식별자
   * 예: 'mcp-blog-client'
   */
  @Column({ unique: true })
  clientId: string;

  /**
   * 클라이언트 시크릿 (해시 저장)
   * bcrypt로 해싱하여 저장
   */
  @Column()
  clientSecret: string;

  /**
   * 클라이언트 이름
   * UI에 표시될 친근한 이름
   */
  @Column()
  clientName: string;

  /**
   * 허용된 리다이렉트 URI 목록
   * 예: ['http://localhost:8080/callback']
   */
  @Column('simple-array')
  redirectUris: string[];

  /**
   * 허용된 권한 스코프
   * MCP는 오직 'mcp:post:create'만 허용
   */
  @Column('simple-array', { default: 'mcp:post:create' })
  allowedScopes: string[];

  /**
   * 허용된 인증 방식
   * authorization_code만 지원
   */
  @Column({ default: 'authorization_code' })
  grantTypes: string;

  /**
   * 클라이언트 소유자
   * 이 클라이언트를 생성한 사용자
   */
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * 클라이언트 활성 상태
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * 신뢰할 수 있는 클라이언트 여부
   * true면 동의 화면 생략 가능
   */
  @Column({ default: false })
  isTrusted: boolean;

  /**
   * 클라이언트 설명
   */
  @Column({ nullable: true, type: 'text' })
  description: string;

  /**
   * 마지막 사용 시간
   */
  @Column({ nullable: true })
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}