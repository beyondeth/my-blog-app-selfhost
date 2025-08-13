import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // 실제 API 키 (해시 저장)

  @Column({ nullable: true })
  signingSecret: string; // HMAC 서명용 시크릿 (암호화 저장)

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}