import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Message } from './message.entity';

@Entity('conversations')
@Index(['user1Id', 'user2Id'], { unique: true })
@Index(['lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user1Id: string;

  @Column({ type: 'uuid' })
  user2Id: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  user1LastReadAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  user2LastReadAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  user1DeletedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  user2DeletedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  // 법적 보호: 사용자 간 분쟁 대비 30일 보관
  // 사용자 삭제 시 CASCADE 아닌 SET NULL로 변경하여 메시지 보관
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user1Id' })
  user1: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user2Id' })
  user2: User;

  @OneToMany(() => Message, message => message.conversation)
  messages: Message[];
}