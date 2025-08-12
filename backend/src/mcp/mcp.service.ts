import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { UpdatePostDto } from '../posts/dto/update-post.dto';
import { formatDate, generateSlug } from '../posts/utils/post.utils';

@Injectable()
export class McpService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Blog)
    private blogRepository: Repository<Blog>,
  ) {}

  /**
   * MCP를 통한 포스트 생성
   */
  async createPost(createPostDto: CreatePostDto, blog: Blog, user: any): Promise<Post> {
    const post = this.postRepository.create({
      ...createPostDto,
      blogId: blog.id,
      blog: blog,
      authorId: user.id,
      author: user,
      isPublished: true,
      publishedAt: new Date(),
    });

    // slug 생성
    if (!post.slug) {
      post.slug = generateSlug(post.title);
    }

    // slug 유니크 체크
    await this.ensureUniqueSlug(post);

    return await this.postRepository.save(post);
  }

  /**
   * 블로그의 포스트 목록 조회
   */
  async getPosts(blogId: string, page: number = 1, limit: number = 10): Promise<{ posts: any[]; total: number }> {
    const [posts, total] = await this.postRepository.findAndCount({
      where: { blogId, isPublished: true },
      relations: ['author'],
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const postsWithFormattedDates = posts.map(post => ({
      ...post,
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
    }));

    return { posts: postsWithFormattedDates, total };
  }

  /**
   * 포스트 수정
   */
  async updatePost(postId: string, updateData: UpdatePostDto, blogId: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id: postId, blogId },
      relations: ['author', 'blog'],
    });

    if (!post) {
      throw new Error('Post not found or access denied');
    }

    Object.assign(post, updateData);

    if (updateData.title && !updateData.slug) {
      post.slug = generateSlug(updateData.title);
      await this.ensureUniqueSlug(post);
    }

    return await this.postRepository.save(post);
  }

  /**
   * 포스트 삭제
   */
  async deletePost(postId: string, blogId: string): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id: postId, blogId },
    });

    if (!post) {
      throw new Error('Post not found or access denied');
    }

    await this.postRepository.remove(post);
  }

  /**
   * slug 유니크 체크
   */
  private async ensureUniqueSlug(post: Post): Promise<void> {
    let slug = post.slug;
    let counter = 1;

    while (true) {
      const existingPost = await this.postRepository.findOne({
        where: { slug },
      });

      if (!existingPost || existingPost.id === post.id) {
        post.slug = slug;
        break;
      }

      slug = `${post.slug}-${counter}`;
      counter++;
    }
  }
}