import { Injectable } from "@nestjs/common";
import { Post } from "../entities/post.entity";
import { PostMetadata } from "../entities/post-metadata.entity";

type ShadowPostFields = Pick<
  Post,
  | "id"
  | "excerpt"
  | "tags"
  | "category"
  | "content_type"
  | "publishedAt"
  | "processingError"
  | "processingCompletedAt"
  | "indexedAt"
>;

@Injectable()
export class PostMetadataSyncService {
  ensureMetadata(postId: string, metadata?: PostMetadata | null): PostMetadata {
    const target = metadata ?? new PostMetadata();
    target.postId = postId;
    target.tags = Array.isArray(target.tags) ? target.tags : [];
    return target;
  }

  syncShadowFromPost(
    post: ShadowPostFields,
    metadata?: PostMetadata | null,
    options?: {
      contentRenderedAt?: Date | null;
    },
  ): PostMetadata {
    const target = this.ensureMetadata(post.id, metadata);
    target.excerpt = post.excerpt ?? null;
    target.tags = [...(post.tags ?? [])];
    target.category = post.category ?? "기타";
    target.content_type = post.content_type ?? "html";
    target.publishedAt = post.publishedAt ?? null;
    target.processingError = post.processingError ?? null;
    target.processingCompletedAt = post.processingCompletedAt ?? null;
    target.indexedAt = post.indexedAt ?? null;

    if (
      options &&
      Object.prototype.hasOwnProperty.call(options, "contentRenderedAt")
    ) {
      target.content_rendered_at = options.contentRenderedAt ?? null;
    }

    return target;
  }
}
