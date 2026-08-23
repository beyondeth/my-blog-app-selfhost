import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Organization } from "./organization.entity";

export enum OrganizationRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export enum OrganizationMemberStatus {
  ACTIVE = "active",
  INVITED = "invited",
  SUSPENDED = "suspended",
}

@Entity("organization_members")
@Index(["organizationId", "userId"], { unique: true })
@Index(["userId", "status"])
export class OrganizationMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.members, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organizationId" })
  organization: Organization;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "varchar",
    length: 20,
    default: OrganizationRole.MEMBER,
  })
  role: OrganizationRole;

  @Column({
    type: "varchar",
    length: 20,
    default: OrganizationMemberStatus.ACTIVE,
  })
  status: OrganizationMemberStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
