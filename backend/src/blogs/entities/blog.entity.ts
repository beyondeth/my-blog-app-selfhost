import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

@Entity('blogs')
export class Blog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  slug: string; // URL 주소 (영문, 숫자, 하이픈만)

  @Column({ nullable: true })
  name: string; // 블로그 이름

  @Column({ nullable: true })
  description: string; // 블로그 설명

  @Column({ nullable: true })
  thumbnailUrl: string; // 블로그 썸네일

  @Column({ type: 'uuid', nullable: true, unique: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  owner: User;

  @OneToMany(() => Post, post => post.blog)
  posts: Post[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}