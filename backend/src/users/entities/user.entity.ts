import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToMany,
  Index,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Role } from '../../common/enums/role.enum';

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  KAKAO = 'kakao',
}

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

  @Column({ nullable: true, length: 500 })
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

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  // Refresh Token 관련 필드 추가
  @Column({ nullable: true, length: 500 })
  @Exclude({ toPlainOnly: true })
  refreshToken: string;

  @Column({ nullable: true })
  @Exclude({ toPlainOnly: true })
  refreshTokenExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 관계 설정 - UUID 참조로 변경 필요
  @OneToMany(() => Post, post => post.author, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany(() => Comment, comment => comment.author, { lazy: true })
  comments: Promise<Comment[]>;

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