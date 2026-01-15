import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  Index,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { Blog } from "./blog.entity";

/**
 * OldAlias 엔티티
 *
 * **설계 원칙 (체크포인트 2):**
 * - Blog alias 변경 시 이전 alias 보관
 * - SEO 보호: 이전 주소로 접속 시 301 리다이렉트
 * - Google 검색 순위 유지 (301은 링크 주스 전달)
 * - 사용자 북마크 및 외부 링크 보호
 *
 * **시나리오:**
 * 1. 사용자가 @park → @coder로 alias 변경
 * 2. old_aliases 테이블에 { oldAlias: 'park', blogId, changedAt } 저장
 * 3. 이후 codebase.blog/@park 접속 시:
 *    - OldAlias 테이블 조회
 *    - 현재 alias 'coder' 확인
 *    - 301 리다이렉트: /blog/@coder
 *
 * **검색 우선순위:**
 * 1. alias (현재 주소)
 * 2. old_alias (이전 주소) → 301 리다이렉트
 * 3. slug (폴백)
 *
 * **성능 최적화:**
 * - oldAlias에 unique index (빠른 조회)
 * - blogId에 index (블로그별 이력 조회)
 * - changedAt에 index (오래된 이력 정리용)
 */
@Entity("old_aliases")
@Index(["oldAlias"], { unique: true }) // 이전 alias는 고유해야 함
@Index(["blogId"]) // 블로그별 이력 조회
@Index(["changedAt"]) // 오래된 이력 배치 정리용
export class OldAlias {
  /**
   * 기본 키 (UUID v7)
   * - 시간순 정렬로 alias 변경 이력 추적 용이
   */
  @PrimaryColumn("uuid")
  id: string;

  /**
   * Blog 관계 (N:1)
   * - 하나의 블로그는 여러 이전 alias를 가질 수 있음
   * - onDelete: 'CASCADE' → Blog 삭제 시 이력도 삭제
   */
  @ManyToOne(() => Blog, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blogId" })
  blog: Blog;

  @Column({ type: "uuid", nullable: false })
  blogId: string;

  /**
   * 이전 alias
   * - 사용자가 변경하기 전의 alias
   * - unique 제약조건 (다른 블로그가 사용 불가)
   * - @ 없이 저장 (예: 'park')
   *
   * **중요:**
   * - 한 번 사용된 alias는 영구적으로 예약됨
   * - 다른 사용자가 재사용 불가 (SEO 혼란 방지)
   * - 예: @park를 사용했다면, 다른 누구도 @park 사용 불가
   */
  @Column({ unique: true, length: 100 })
  oldAlias: string;

  /**
   * Alias 변경 시각
   * - 이력 추적용
   * - 오래된 이력 정리 기준 (예: 2년 이상 된 이력 삭제)
   * - 감사 로그 (누가 언제 변경했는지)
   */
  @Column({ type: "timestamp" })
  changedAt: Date;

  /**
   * 리다이렉트 대상 (최신 alias)
   * - 다중 alias 변경 시 리다이렉트 체인 관리
   * - 예: oldAlias='luticek', redirectTo='luticek3'
   */
  @Column({ name: "redirectto", length: 100, nullable: true })
  redirectTo: string;

  /**
   * 생성 시각
   * - 데이터 추적용
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * UUID v7 자동 생성
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 오래된 이력 여부 (2년 이상)
   * - 배치 작업에서 정리 대상 판별
   * - 하지만 SEO를 위해 영구 보관 권장
   */
  isOld(): boolean {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return this.changedAt < twoYearsAgo;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      oldAlias: this.oldAlias,
      changedAt: this.changedAt,
      blogId: this.blogId,
    };
  }
}
