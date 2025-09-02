import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToMany,
  OneToOne,
  Index,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { CommentLike } from '../../comments/entities/comment-like.entity';
import { Role } from '../../common/enums/role.enum';
import { Follow } from '../../follows/entities/follow.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { UserIdentity } from './user-identity.entity';

export const AuthProvider = {
  LOCAL: 'local',
  GOOGLE: 'google',
  KAKAO: 'kakao',
  GITHUB: 'github',
} as const;

export type AuthProvider = typeof AuthProvider[keyof typeof AuthProvider];

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ nullable: true, length: 255 })
  @Exclude({ toPlainOnly: true })
  password: string;

  @Column({ nullable: true, length: 100 })
  username: string;

  @Column({ nullable: true, length: 500 })
  profileImage: string;

  @Column({ nullable: true, length: 1000 })
  bio: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  @Column({ nullable: true, length: 255 })
  providerId: string;

  @Column({ default: false, name: 'isEmailVerified' })
  isEmailVerified: boolean;

  @Column({ default: true, name: 'isActive' })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  // Refresh Token 관련 필드 추가
  @Column({ nullable: true, length: 500, name: 'refreshToken' })
  @Exclude({ toPlainOnly: true })
  refreshToken: string;

  @Column({ nullable: true, name: 'refreshTokenExpiresAt' })
  @Exclude({ toPlainOnly: true })
  refreshTokenExpiresAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // 관계 설정 - UUID 참조로 변경 필요
  @OneToOne(() => Blog, blog => blog.owner, { eager: true })
  blog: Blog;

  @OneToMany(() => Post, post => post.author, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany(() => Comment, comment => comment.author, { lazy: true })
  comments: Promise<Comment[]>;

  @OneToMany(() => CommentLike, commentLike => commentLike.user, { lazy: true })
  commentLikes: Promise<CommentLike[]>;

  // Follow relationships
  @OneToMany(() => Follow, follow => follow.follower, { lazy: true })
  following: Promise<Follow[]>;

  @OneToMany(() => Follow, follow => follow.following, { lazy: true })
  followers: Promise<Follow[]>;

  // Notification relationships
  @OneToMany(() => Notification, notification => notification.recipient, { lazy: true })
  receivedNotifications: Promise<Notification[]>;

  @OneToMany(() => Notification, notification => notification.issuer, { lazy: true })
  issuedNotifications: Promise<Notification[]>;

  // Identity relationships for Multi-Identity Architecture
  @OneToMany(() => UserIdentity, identity => identity.user, { cascade: true })
  identities: UserIdentity[];

  @Column({ nullable: true })
  primaryIdentityId: string;

  @Column({ nullable: true, length: 50 })
  lastLoginProvider: string;

  @Column({ nullable: true })
  accountVerifiedAt: Date;

  @Column({ nullable: true, length: 20, default: 'basic' })
  accountSecurityLevel: string;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && this.authProvider === AuthProvider.LOCAL) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  // 공개할 사용자 정보만 반환 (보안 강화)
  toPublicJSON() {
    return {
      id: this.id,
      username: this.username,
      profileImage: this.profileImage,
      bio: this.bio,
      role: this.role,
      isEmailVerified: this.isEmailVerified,
      createdAt: this.createdAt,
    };
  }

  toJSON() {
    const { password, refreshToken, refreshTokenExpiresAt, ...result } = this;
    return result;
  }
} 