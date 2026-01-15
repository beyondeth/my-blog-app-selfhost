import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import { validate as isValidUuid } from "uuid";

/**
 * 커뮤니티 ID 파라미터 데코레이터
 *
 * @description
 * URL 파라미터에서 커뮤니티 ID 또는 slug를 추출하고 검증
 * Guard에서 조회한 커뮤니티 정보도 함께 반환 가능
 *
 * @example
 * // URL: /communities/:communityId
 * @Get(':communityId')
 * getCommunity(@CommunityId() communityId: string) { ... }
 *
 * // URL: /communities/:slug
 * @Get(':slug')
 * getCommunity(@CommunityId('slug') identifier: string) { ... }
 */
export const CommunityId = createParamDecorator(
  (paramName: string = "communityId", ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const identifier = request.params[paramName];

    if (!identifier) {
      throw new BadRequestException(
        `커뮤니티 식별자(${paramName})가 필요합니다`,
      );
    }

    return identifier;
  },
);

/**
 * 커뮤니티 slug 파라미터 데코레이터 (편의용)
 */
export const CommunitySlug = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const slug = request.params.slug;

    if (!slug) {
      throw new BadRequestException("커뮤니티 slug가 필요합니다");
    }

    // slug 형식 검증 (소문자 영문, 숫자, 하이픈만 허용)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException("유효하지 않은 커뮤니티 slug 형식입니다");
    }

    return slug;
  },
);

/**
 * 게시물 ID 파라미터 데코레이터
 */
export const CommunityPostId = createParamDecorator(
  (paramName: string = "postId", ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const postId = request.params[paramName];

    if (!postId) {
      throw new BadRequestException("게시물 ID가 필요합니다");
    }

    // UUID 형식 검증
    if (!isValidUuid(postId)) {
      throw new BadRequestException("유효하지 않은 게시물 ID 형식입니다");
    }

    return postId;
  },
);

/**
 * 댓글 ID 파라미터 데코레이터
 */
export const CommunityCommentId = createParamDecorator(
  (paramName: string = "commentId", ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const commentId = request.params[paramName];

    if (!commentId) {
      throw new BadRequestException("댓글 ID가 필요합니다");
    }

    // UUID 형식 검증
    if (!isValidUuid(commentId)) {
      throw new BadRequestException("유효하지 않은 댓글 ID 형식입니다");
    }

    return commentId;
  },
);
