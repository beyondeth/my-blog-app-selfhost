import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("follows")
@Unique(["followerId", "followingId"])
@Index(["followerId"])
@Index(["followingId"])
export class Follow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "follower_id" })
  followerId: string;

  @Column({ type: "uuid", name: "following_id" })
  followingId: string;

  @ManyToOne(() => User, (user) => user.following, {
    onDelete: "CASCADE",
    eager: false,
  })
  @JoinColumn({ name: "follower_id" })
  follower: User;

  @ManyToOne(() => User, (user) => user.followers, {
    onDelete: "CASCADE",
    eager: false,
  })
  @JoinColumn({ name: "following_id" })
  following: User;

  @CreateDateColumn()
  createdAt: Date;
}
