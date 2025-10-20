import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { OAuthClient } from './oauth-client.entity';

/**
 * OAuth2 인증 코드 엔티티
 * Authorization Code 플로우에서 사용되는 임시 코드
 */
@Entity('oauth_codes')
@Index(['code'], { unique: true })
@Index(['expiresAt'])
export class OAuthCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 인증 코드
   * 클라이언트에게 전달되는 일회용 코드
   */
  @Column({ unique: true })
  code: string;

  /**
   * 코드를 요청한 사용자
   */
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * 사용자의 블로그
   * 코드 교환 시 토큰에 바인딩될 블로그
   */
  @Column()
  blogId: string;

  @ManyToOne(() => Blog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blogId' })
  blog: Blog;

  /**
   * 요청한 OAuth 클라이언트
   */
  @Column()
  clientId: string;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: OAuthClient;

  /**
   * 리다이렉트 URI
   * 코드 교환 시 검증용
   */
  @Column()
  redirectUri: string;

  /**
   * 요청된 권한 스코프
   */
  @Column('simple-array')
  scopes: string[];

  /**
   * PKCE code challenge
   * 추가 보안을 위한 PKCE 검증값
   */
  @Column({ nullable: true })
  codeChallenge: string;

  /**
   * PKCE code challenge method
   * 'S256' | 'plain'
   */
  @Column({ nullable: true })
  codeChallengeMethod: string;

  /**
   * 코드 만료 시간
   * 기본 5분
   */
  @Column()
  expiresAt: Date;

  /**
   * 코드 사용 여부
   * 한 번 사용되면 재사용 불가
   */
  @Column({ default: false })
  isUsed: boolean;

  /**
   * 코드 사용 시간
   */
  @Column({ nullable: true })
  usedAt: Date;

  /**
   * 코드 발급 시 IP 주소
   */
  @Column({ nullable: true })
  issuedIp: string;

  /**
   * State 파라미터
   * CSRF 공격 방지용
   */
  @Column({ nullable: true })
  state: string;

  /**
   * Resource Indicator (RFC 8707)
   * 이 코드로 발급된 토큰이 사용될 Resource Server의 URI
   *
   * MCP 표준: MCP 서버의 공개 URL (예: http://localhost:3002)
   * Access Token의 audience (aud) claim으로 포함됨
   */
  @Column({ nullable: true })
  resource: string;

  @CreateDateColumn()
  createdAt: Date;
}