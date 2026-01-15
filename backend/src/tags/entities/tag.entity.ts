import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("tags")
@Index(["name"], { unique: true })
@Index(["slug"], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ default: 0 })
  postCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ManyToMany 관계 제거 - JSONB로 단순화
  // posts 배열은 더 이상 사용하지 않음
}
