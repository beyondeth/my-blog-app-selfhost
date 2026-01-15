import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Tag } from "./entities/tag.entity";

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagsRepository: Repository<Tag>,
  ) {}

  /**
   * Find or create tags by names
   * 태그가 없으면 생성하고, 있으면 기존 태그 반환
   */
  async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
    if (!tagNames || tagNames.length === 0) {
      return [];
    }

    const normalizedNames = tagNames.map((name) => name.trim().toLowerCase());

    // 기존 태그 찾기
    const existingTags = await this.tagsRepository.find({
      where: { name: In(normalizedNames) },
    });

    const existingTagNames = new Set(existingTags.map((tag) => tag.name));
    const newTagNames = normalizedNames.filter(
      (name) => !existingTagNames.has(name),
    );

    // 새 태그 생성
    const newTags = await Promise.all(
      newTagNames.map(async (name) => {
        const slug = this.generateSlug(name);
        const tag = this.tagsRepository.create({
          name,
          slug,
          postCount: 0,
        });
        return this.tagsRepository.save(tag);
      }),
    );

    return [...existingTags, ...newTags];
  }

  /**
   * Increment post count for tags
   */
  async incrementPostCount(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    await this.tagsRepository
      .createQueryBuilder()
      .update(Tag)
      .set({ postCount: () => "postCount + 1" })
      .whereInIds(tagIds)
      .execute();
  }

  /**
   * Decrement post count for tags
   */
  async decrementPostCount(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    await this.tagsRepository
      .createQueryBuilder()
      .update(Tag)
      .set({ postCount: () => "GREATEST(postCount - 1, 0)" })
      .whereInIds(tagIds)
      .execute();
  }

  /**
   * Find tags by post
   */
  async findByPost(postId: string): Promise<Tag[]> {
    return this.tagsRepository
      .createQueryBuilder("tag")
      .innerJoin("tag.posts", "post")
      .where("post.id = :postId", { postId })
      .getMany();
  }

  /**
   * Search tags by name pattern
   */
  async searchTags(pattern: string): Promise<Tag[]> {
    return this.tagsRepository
      .createQueryBuilder("tag")
      .where("tag.name LIKE :pattern", { pattern: `%${pattern}%` })
      .orderBy("tag.postCount", "DESC")
      .limit(10)
      .getMany();
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit = 20): Promise<Tag[]> {
    return this.tagsRepository.find({
      order: {
        postCount: "DESC",
      },
      take: limit,
    });
  }

  /**
   * Generate slug from tag name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}
