/**
 * 블로그 관련 이벤트 상수
 *
 * 이벤트 기반 통신을 통해 순환 의존성을 피하고
 * 느슨한 결합도(loose coupling) 달성
 */
export enum BlogEvent {
  // 블로그 생성
  BLOG_CREATED = "blog.created",

  // 블로그 정보 업데이트
  BLOG_UPDATED = "blog.updated",

  // 블로그 별칭(alias) 변경
  BLOG_ALIAS_CHANGED = "blog.alias.changed",

  // 블로그 설정 변경
  BLOG_SETTINGS_CHANGED = "blog.settings.changed",

  // 포스트 생성
  BLOG_POST_CREATED = "blog.post.created",

  // 포스트 업데이트
  BLOG_POST_UPDATED = "blog.post.updated",

  // 포스트 삭제
  BLOG_POST_DELETED = "blog.post.deleted",

  // 포스트 좋아요
  BLOG_POST_LIKED = "blog.post.liked",

  // 포스트 조회
  BLOG_POST_VIEWED = "blog.post.viewed",

  // 블로그 통계 업데이트 필요
  BLOG_STATS_UPDATE_REQUIRED = "blog.stats.update.required",
}
