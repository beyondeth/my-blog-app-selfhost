import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";
import { Post } from "../entities/post.entity";

type SearchVectorSource = Pick<
  Post,
  "title" | "excerpt" | "content" | "content_markdown" | "tags"
>;

@Injectable()
export class PostSearchVectorService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  buildSearchText(source: SearchVectorSource): string {
    const title = this.normalize(source.title);
    const excerpt = this.normalize(source.excerpt);
    const tags = this.normalize(
      Array.isArray(source.tags) ? source.tags.join(" ") : "",
    );
    const content = this.normalize(
      source.content_markdown || this.stripHtml(source.content) || "",
    );

    return [title, excerpt, tags, content].filter(Boolean).join(" ").trim();
  }

  async syncSearchVector(
    postId: string,
    source: SearchVectorSource,
    manager?: EntityManager,
  ): Promise<void> {
    const queryRunner = manager ?? this.dataSource.manager;
    const searchText = this.buildSearchText(source);

    await queryRunner.query(
      `
        UPDATE "posts"
        SET
          "search_vector" = to_tsvector('simple', $1),
          "indexed_at" = NOW()
        WHERE id = $2
      `,
      [searchText, postId],
    );

    await queryRunner.query(
      `
        UPDATE "post_metadata"
        SET
          "searchVector" = to_tsvector('simple', $1),
          "indexedAt" = NOW()
        WHERE "postId" = $2
      `,
      [searchText, postId],
    );
  }

  async syncSearchVectors(
    posts: Array<SearchVectorSource & { id: string }>,
    manager?: EntityManager,
  ): Promise<void> {
    for (const post of posts) {
      await this.syncSearchVector(post.id, post, manager);
    }
  }

  private stripHtml(content?: string | null): string {
    if (!content) {
      return "";
    }

    return content
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, " and ");
  }

  private normalize(value?: string | null): string {
    if (!value) {
      return "";
    }

    return value
      .replace(/[`*_#[\](){}<>|~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
