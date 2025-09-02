import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  CreateDateColumn,
  JoinColumn,
  Index,
  Unique
} from 'typeorm';
import { User } from './user.entity';

// Extend AuthProvider to include more providers
export enum IdentityProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  KAKAO = 'kakao',
  GITHUB = 'github',
  NAVER = 'naver',
}

@Entity('user_identities')
@Unique(['provider', 'providerId'])
@Index(['userId'])
@Index(['provider'])
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ name: 'userId' })
  userId: string;

  @Column({ 
    type: 'enum',
    enum: IdentityProvider 
  })
  provider: IdentityProvider;

  @Column({ name: 'providerId' })
  providerId: string;

  @Column({ name: 'providerEmail', nullable: true })
  providerEmail: string;

  @Column({ 
    type: 'jsonb', 
    name: 'providerData',
    nullable: true,
    comment: 'Additional provider-specific data (profile picture, name, etc.)' 
  })
  providerData: {
    name?: string;
    picture?: string;
    locale?: string;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'linkedAt' })
  linkedAt: Date;

  @Column({ 
    name: 'lastUsedAt',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP' 
  })
  lastUsedAt: Date;

  // Helper methods
  updateLastUsed(): void {
    this.lastUsedAt = new Date();
  }

  isGitHub(): boolean {
    return this.provider === IdentityProvider.GITHUB;
  }

  isGoogle(): boolean {
    return this.provider === IdentityProvider.GOOGLE;
  }

  isKakao(): boolean {
    return this.provider === IdentityProvider.KAKAO;
  }

  isLocal(): boolean {
    return this.provider === IdentityProvider.LOCAL;
  }

  // Security check methods
  isTrustedProvider(): boolean {
    // Google and GitHub verify email addresses
    return [IdentityProvider.GOOGLE, IdentityProvider.GITHUB].includes(this.provider);
  }

  // For displaying in UI
  getProviderDisplayName(): string {
    const displayNames = {
      [IdentityProvider.LOCAL]: 'Email/Password',
      [IdentityProvider.GOOGLE]: 'Google',
      [IdentityProvider.KAKAO]: 'KakaoTalk',
      [IdentityProvider.GITHUB]: 'GitHub',
      [IdentityProvider.NAVER]: 'Naver',
    };
    return displayNames[this.provider] || this.provider;
  }

  getProviderIcon(): string {
    const icons = {
      [IdentityProvider.LOCAL]: '🔑',
      [IdentityProvider.GOOGLE]: '🔍',
      [IdentityProvider.KAKAO]: '💬',
      [IdentityProvider.GITHUB]: '🐙',
      [IdentityProvider.NAVER]: '🍀',
    };
    return icons[this.provider] || '🔐';
  }
}