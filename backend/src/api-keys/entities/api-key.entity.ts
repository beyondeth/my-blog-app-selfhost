import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  key: string; // 이전 API 키 (deprecated, 하위 호환성을 위해 유지)

  @Column({ unique: true, nullable: true })
  keyId: string; // API Key ID (공개 가능, akid_xxx 형식)

  @Column({ nullable: true })
  keySecret: string; // API Key Secret (해시 저장, aks_xxx 형식)

  @Column({ nullable: true })
  signingSecret: string; // HMAC 서명용 시크릿 (암호화 저장) - deprecated, keySecret 사용

  @Column()
  name: string; // API 키 이름 (사용자가 구분하기 위한 용도)

  @Column({ nullable: true })
  description: string; // API 키 설명

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  blogId: string;

  @ManyToOne(() => Blog)
  @JoinColumn({ name: 'blogId' })
  blog: Blog;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date; // API 키 만료 시간

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}