import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, SelectQueryBuilder } from "typeorm";
import { Post } from "../entities/post.entity";
import { GetPostsCursorDto } from "../dto/get-posts-cursor.dto";
import { User } from "../../users/entities/user.entity";
import { PostAccessPolicyService } from "../services/post-access-policy.service";

/**
 * 읽기 쿼리 라우팅/일관성 정책
 */
export enum ReadPolicy {
  Primary = "primary", // 강한 일관성: Master DB 사용
  Replica = "replica", // 지연 일관성: Read Replica 사용 (기본)
  CacheFirst = "cache_first", // 극단적 캐시 우선 (구현 보류/캐시 레이어로 이관)
}

/**
 * PostsReadRepository
 *
 * V4 Refactoring:
 * 복잡한 조회 쿼리(QueryBuilder)를 Service 계층에서 분리하여 캡슐화합니다.
 * 향후 DB Read Replica 확장 시, ReadPolicy를 기반으로 커넥션을 라우팅하는 기반을 제공합니다.
 */
@Injectable()
export class PostsReadRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly postAccessPolicyService: PostAccessPolicyService,
  ) {}

  /**
   * 커스텀 QueryBuilder 생성기 (읽기 전용 정책 주입)
   * 추후 TypeORM Replication 활성화 시 queryRunner 분기용 훅 포인트
   */
  private createQueryBuilder(
    alias: string,
    policy: ReadPolicy = ReadPolicy.Replica,
  ): SelectQueryBuilder<Post> {
    // [V4 미래 확장 슬롯]
    // if (policy === ReadPolicy.Primary) {
    //   const qr = this.dataSource.createQueryRunner("master");
    //   return this.dataSource.createQueryBuilder(Post, alias, qr);
    // }
    return this.postsRepository.createQueryBuilder(alias);
  }

  /**
   * 커서 기반 포스트 목록 조회용 QueryBuilder 반환
   */
  getCursorPaginatedQueryBuilder(
    dto: GetPostsCursorDto,
    user?: User,
    policy: ReadPolicy = ReadPolicy.Replica,
  ): SelectQueryBuilder<Post> {
    const query = this.createQueryBuilder("post", policy)
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.stats", "stats")
      .leftJoin("post.metadata", "metadata")
      .addSelect([
        "metadata.excerpt",
        "metadata.tags",
        "metadata.category",
        "metadata.isEditorPick",
      ]);

    const whereConditions: string[] = [];
    const parameters: Record<string, any> = {};

    // 기본 필터: 항상 적용 (로그인 여부 무관)
    whereConditions.push("post.isPublished = :isPublished");
    whereConditions.push("post.isDeleted = :isDeleted");
    whereConditions.push("post.status = :publishedStatus");
    parameters.isPublished = true;
    parameters.isDeleted = false;
    parameters.publishedStatus = "published";

    // visibility 필터: 소유자/관리자만 비공개 블로그/비공개 포스트 접근 허용
    if (user) {
      whereConditions.push(
        "((blog.isPublic = true AND post.visibility = :postVisibility) OR blog.userId = :viewerId OR post.authorId = :viewerId OR :userRole = 'admin')",
      );
      parameters.postVisibility =
        this.postAccessPolicyService.getPublicVisibilityQueryValue();
      parameters.viewerId = user.id;
      parameters.userRole = user.role;
    } else {
      whereConditions.push("blog.isPublic = :isPublic");
      whereConditions.push("post.visibility = :postVisibility");
      parameters.isPublic = true;
      parameters.postVisibility =
        this.postAccessPolicyService.getPublicVisibilityQueryValue();
    }

    const normalizedBlogIdentifier = dto.blogSlug?.startsWith("@")
      ? dto.blogSlug.slice(1)
      : dto.blogSlug;

    if (dto.blogId) {
      whereConditions.push("blog.id = :blogId");
      parameters.blogId = dto.blogId;
    } else if (normalizedBlogIdentifier) {
      // blogSlug 파라미터는 slug/alias 둘 다 허용한다.
      whereConditions.push(
        "(blog.slug = :blogIdentifier OR blog.alias = :blogIdentifier)",
      );
      parameters.blogIdentifier = normalizedBlogIdentifier;
    }

    if (dto.category) {
      whereConditions.push("post.category = :category");
      parameters.category = dto.category;
    }

    if (dto.tag) {
      whereConditions.push("post.tags @> :tag");
      parameters.tag = JSON.stringify([dto.tag]);
    }

    // postType 필터: 지정 시 해당 유형만, 미지정 시 blog만 (마켓플레이스 상품 제외)
    if (dto.postType) {
      whereConditions.push('post."postType" = :postType');
      parameters.postType = dto.postType;
      // product 조회 시 ProductDetail도 함께 로드 (가격, 카테고리 등)
      if (dto.postType === "product") {
        query.leftJoinAndSelect("post.productDetail", "productDetail");
      }
    } else {
      whereConditions.push('COALESCE(post."postType", \'blog\') = \'blog\'');
    }

    if (whereConditions.length > 0) {
      const [firstCondition, ...restConditions] = whereConditions;
      query.where(firstCondition, parameters);
      restConditions.forEach((condition) =>
        query.andWhere(condition, parameters),
      );
    }

    if (dto.dateFrom) {
      query.andWhere("post.publishedAt >= :dateFrom", {
        dateFrom: dto.dateFrom,
      });
    }
    if (dto.dateTo) {
      query.andWhere("post.publishedAt <= :dateTo", { dateTo: dto.dateTo });
    }

    return query;
  }

  /**
   * ID 기반 상세 포스트 조회 쿼리 반환
   */
  async findByIdWithRelations(
    id: string,
    relations: string[] = [],
    policy: ReadPolicy = ReadPolicy.Replica,
  ): Promise<Post | null> {
    const query = this.createQueryBuilder("post", policy)
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.attachedFiles", "attachedFiles")
      .leftJoinAndSelect("post.stats", "stats")
      .leftJoin("post.metadata", "metadata")
      .addSelect([
        "metadata.excerpt",
        "metadata.tags",
        "metadata.category",
        "metadata.content_rendered_at",
        "metadata.isEditorPick",
        "metadata.wordCount",
        "metadata.readingTimeMinutes",
      ])
      .where("post.id = :id", { id });

    const defaultRelations = [
      "author",
      "author.profile",
      "blog",
      "thumbnailImage",
      "attachedFiles",
      "stats",
      "metadata",
    ];

    if (relations.length > 0) {
      relations.forEach((relation) => {
        if (!defaultRelations.includes(relation)) {
          query.leftJoinAndSelect(`post.${relation}`, relation);
        }
      });
    }

    return query.getOne();
  }

  /**
   * Slug 기반 풀 상세 포스트 조회 쿼리 반환
   */
  async findBySlugWithRelations(
    slug: string,
    policy: ReadPolicy = ReadPolicy.Replica,
  ): Promise<Post | null> {
    const query = this.createQueryBuilder("post", policy)
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .leftJoinAndSelect("post.blog", "blog")
      .leftJoinAndSelect("post.thumbnailImage", "thumbnailImage")
      .leftJoinAndSelect("post.attachedFiles", "attachedFiles")
      .leftJoinAndSelect("post.stats", "stats")
      .leftJoinAndSelect("post.metadata", "metadata")
      .where("post.slug = :slug", { slug });

    return query.getOne();
  }
}
