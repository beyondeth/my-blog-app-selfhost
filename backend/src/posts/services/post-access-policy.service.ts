import { Injectable } from "@nestjs/common";
import { Role } from "../../common/enums/role.enum";

export type PostVisibility = "public" | "private";

interface PostAccessSubject {
  authorId?: string | null;
  isPublished?: boolean;
  isDeleted?: boolean;
  visibility?: string | null;
}

interface BlogAccessSubject {
  userId?: string | null;
  isPublic?: boolean | null;
}

interface AccessActor {
  id?: string | null;
  role?: string | null;
}

@Injectable()
export class PostAccessPolicyService {
  readonly PUBLIC_VISIBILITY: PostVisibility = "public";
  readonly PRIVATE_VISIBILITY: PostVisibility = "private";

  normalizeVisibility(value?: string | null): PostVisibility {
    return value === this.PRIVATE_VISIBILITY
      ? this.PRIVATE_VISIBILITY
      : this.PUBLIC_VISIBILITY;
  }

  isOwnerOrAdmin(
    actor: AccessActor | null | undefined,
    subject: { authorId?: string | null; blogOwnerId?: string | null },
  ): boolean {
    if (!actor?.id) {
      return false;
    }

    if (actor.role === Role.ADMIN) {
      return true;
    }

    return actor.id === subject.authorId || actor.id === subject.blogOwnerId;
  }

  isPubliclyReadablePost(
    post: PostAccessSubject,
    blog?: BlogAccessSubject | null,
  ): boolean {
    if (!post.isPublished || post.isDeleted) {
      return false;
    }

    if (this.normalizeVisibility(post.visibility) !== this.PUBLIC_VISIBILITY) {
      return false;
    }

    if (blog && blog.isPublic === false) {
      return false;
    }

    return true;
  }

  canReadPost(
    post: PostAccessSubject,
    blog: BlogAccessSubject | null | undefined,
    actor?: AccessActor | null,
  ): boolean {
    if (
      this.isOwnerOrAdmin(actor, {
        authorId: post.authorId,
        blogOwnerId: blog?.userId,
      })
    ) {
      return true;
    }

    return this.isPubliclyReadablePost(post, blog);
  }

  getPublicVisibilityQueryValue(): PostVisibility {
    return this.PUBLIC_VISIBILITY;
  }

  /**
   * 외부 사용자 기준의 실제 노출 공개 범위
   * - post.visibility 저장값과 blog.isPublic 상위 게이트를 함께 반영
   */
  getEffectiveVisibility(
    post: PostAccessSubject,
    blog?: BlogAccessSubject | null,
  ): PostVisibility {
    return this.isPubliclyReadablePost(post, blog)
      ? this.PUBLIC_VISIBILITY
      : this.PRIVATE_VISIBILITY;
  }

  /**
   * 개별 공개 설정이 상위 블로그 비공개 게이트에 의해 차단되는지 여부
   */
  isVisibilityBlockedByBlogPrivacy(
    post: PostAccessSubject,
    blog?: BlogAccessSubject | null,
  ): boolean {
    return (
      this.normalizeVisibility(post.visibility) === this.PUBLIC_VISIBILITY &&
      blog?.isPublic === false
    );
  }
}
