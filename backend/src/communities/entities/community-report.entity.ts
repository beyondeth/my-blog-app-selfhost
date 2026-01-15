import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { Community } from "./community.entity";
import { CommunityPost } from "./community-post.entity";
import { CommunityComment } from "./community-comment.entity";
import { ReportReason, ReportTargetType, ReportStatus } from "../enums";

/**
 * CommunityReport 엔티티
 *
 * @description 커뮤니티 내 게시물/댓글 신고 정보를 저장합니다.
 *
 * **설계 원칙:**
 * - 신고 대상: 게시물(post) 또는 댓글(comment)
 * - 상태: pending → resolved/dismissed/escalated
 * - 에스컬레이션: 커뮤니티 모더레이터 → 사이트 관리자
 * - 동일 사용자의 중복 신고 방지 (targetType + targetId + reporterId unique)
 */
@Entity("community_reports")
@Index(["communityId", "status", "createdAt"])
@Index(["targetType", "targetPostId", "reporterId"])
@Index(["targetType", "targetCommentId", "reporterId"])
@Index(["isEscalated", "status"])
export class CommunityReport {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 커뮤니티 ID
   */
  @Column({ type: "uuid" })
  communityId: string;

  /**
   * 신고자 ID
   */
  @Column({ type: "uuid" })
  reporterId: string;

  /**
   * 신고 대상 타입 (post | comment)
   */
  @Column({
    type: "enum",
    enum: ReportTargetType,
  })
  targetType: ReportTargetType;

  /**
   * 신고 대상 게시물 ID (targetType이 post인 경우)
   */
  @Column({ type: "uuid", nullable: true })
  targetPostId?: string;

  /**
   * 신고 대상 댓글 ID (targetType이 comment인 경우)
   */
  @Column({ type: "uuid", nullable: true })
  targetCommentId?: string;

  /**
   * 신고 사유
   */
  @Column({
    type: "enum",
    enum: ReportReason,
  })
  reason: ReportReason;

  /**
   * 위반한 커뮤니티 규칙 ID (reason이 RULE_VIOLATION인 경우)
   */
  @Column({ type: "uuid", nullable: true })
  violatedRuleId?: string;

  /**
   * 추가 설명 (신고자가 작성)
   */
  @Column({ type: "text", nullable: true })
  description?: string;

  /**
   * 신고 처리 상태
   */
  @Column({
    type: "enum",
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  /**
   * 처리한 모더레이터 ID
   */
  @Column({ type: "uuid", nullable: true })
  resolvedById?: string;

  /**
   * 처리 시간
   */
  @Column({ type: "timestamp", nullable: true })
  resolvedAt?: Date;

  /**
   * 모더레이터 처리 메모
   */
  @Column({ type: "text", nullable: true })
  moderatorNote?: string;

  /**
   * 사이트 관리자에게 에스컬레이션됨
   */
  @Column({ default: false })
  isEscalated: boolean;

  /**
   * 에스컬레이션 시간
   */
  @Column({ type: "timestamp", nullable: true })
  escalatedAt?: Date;

  /**
   * 에스컬레이션한 모더레이터 ID
   */
  @Column({ type: "uuid", nullable: true })
  escalatedById?: string;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, { onDelete: "CASCADE" })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reporterId" })
  reporter: User;

  @ManyToOne(() => CommunityPost, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "targetPostId" })
  targetPost?: CommunityPost;

  @ManyToOne(() => CommunityComment, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "targetCommentId" })
  targetComment?: CommunityComment;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "resolvedById" })
  resolvedBy?: User;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "escalatedById" })
  escalatedBy?: User;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 대기 중인 신고인지 확인
   */
  isPending(): boolean {
    return this.status === ReportStatus.PENDING;
  }

  /**
   * 처리 완료된 신고인지 확인 (에스컬레이션 포함)
   */
  isHandled(): boolean {
    return (
      this.status === ReportStatus.RESOLVED ||
      this.status === ReportStatus.DISMISSED ||
      this.status === ReportStatus.ESCALATED
    );
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      reporterId: this.reporterId,
      reporter: this.reporter
        ? {
            id: this.reporter.id,
            username: this.reporter.username,
            profileImage: (this.reporter as any).profile?.profileImage || null,
          }
        : null,
      targetType: this.targetType,
      targetPostId: this.targetPostId,
      targetCommentId: this.targetCommentId,
      targetPost: this.targetPost
        ? {
            id: this.targetPost.id,
            title: this.targetPost.title,
            slug: this.targetPost.slug,
            authorId: this.targetPost.authorId,
          }
        : null,
      targetComment: this.targetComment
        ? {
            id: this.targetComment.id,
            content:
              this.targetComment.content?.substring(0, 200) +
              (this.targetComment.content?.length > 200 ? "..." : ""),
            authorId: this.targetComment.authorId,
          }
        : null,
      reason: this.reason,
      violatedRuleId: this.violatedRuleId,
      description: this.description,
      status: this.status,
      resolvedById: this.resolvedById,
      resolvedBy: this.resolvedBy
        ? {
            id: this.resolvedBy.id,
            username: this.resolvedBy.username,
          }
        : null,
      resolvedAt: this.resolvedAt,
      moderatorNote: this.moderatorNote,
      isEscalated: this.isEscalated,
      escalatedAt: this.escalatedAt,
      createdAt: this.createdAt,
    };
  }
}
