import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blog } from './entities/blog.entity';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class BlogsService {
  constructor(
    @InjectRepository(Blog)
    private blogRepository: Repository<Blog>,
  ) {}

  async create(createBlogDto: CreateBlogDto, user: User): Promise<Blog> {
    // 사용자가 이미 블로그를 가지고 있는지 확인 (한 사용자당 하나의 블로그만)
    const userBlog = await this.blogRepository.findOne({
      where: { userId: user.id }
    });

    if (userBlog) {
      throw new ConflictException('이미 블로그를 보유하고 있습니다. 한 계정당 하나의 블로그만 생성할 수 있습니다.');
    }

    // slug 중복 확인
    const existingBlog = await this.blogRepository.findOne({
      where: { slug: createBlogDto.slug }
    });

    if (existingBlog) {
      throw new ConflictException('이미 사용 중인 블로그 주소입니다.');
    }

    const blog = this.blogRepository.create({
      ...createBlogDto,
      userId: user.id
    });

    return await this.blogRepository.save(blog);
  }

  async findOne(id: string): Promise<Blog> {
    const blog = await this.blogRepository.findOne({
      where: { id },
      relations: ['owner']
    });

    if (!blog) {
      throw new NotFoundException('블로그를 찾을 수 없습니다.');
    }

    return blog;
  }

  async findOneBySlug(slug: string, user?: any): Promise<Blog> {
    console.log(`[BlogsService] findOneBySlug - slug: ${slug}, user: ${user?.id || 'none'}`);
    
    const blog = await this.blogRepository.findOne({
      where: { slug },
      relations: ['owner']
    });

    if (!blog) {
      throw new NotFoundException('블로그를 찾을 수 없습니다.');
    }

    console.log(`[BlogsService] Blog found - id: ${blog.id}, userId: ${blog.userId}, isPublic: ${blog.isPublic}`);
    console.log(`[BlogsService] User check - user.id: ${user?.id}, blog.userId: ${blog.userId}, match: ${user?.id === blog.userId}`);

    // 비공개 블로그인 경우, 소유자가 아니면 특별한 응답 반환
    // userId와 user.id 타입을 명시적으로 비교
    const isOwner = user && String(user.id) === String(blog.userId);
    
    if (!blog.isPublic && !isOwner) {
      console.log(`[BlogsService] Private blog, not owner - returning limited info`);
      return {
        id: blog.id,
        slug: blog.slug,
        isPrivate: true,
        message: '비공개 블로그입니다'
      } as any;
    }

    console.log(`[BlogsService] Returning full blog info - owner: ${isOwner}`);
    return blog;
  }

  async findByUserId(userId: string): Promise<Blog[]> {
    return await this.blogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }

  async checkSlugAvailability(slug: string): Promise<boolean> {
    const count = await this.blogRepository.count({
      where: { slug }
    });
    return count === 0;
  }

  async update(id: string, updateBlogDto: UpdateBlogDto): Promise<Blog> {
    const blog = await this.findOne(id);
    
    // isPublic과 allowComments 필드가 없는 경우 기본값 설정
    // 데이터베이스에 필드가 아직 없을 수 있으므로 임시로 처리
    const updatedBlog = {
      ...blog,
      ...updateBlogDto
    };
    
    // isPublic과 allowComments가 undefined인 경우 기본값 설정
    if (updateBlogDto.isPublic !== undefined) {
      updatedBlog.isPublic = updateBlogDto.isPublic;
    }
    if (updateBlogDto.allowComments !== undefined) {
      updatedBlog.allowComments = updateBlogDto.allowComments;
    }
    
    await this.blogRepository.save(updatedBlog);
    return await this.findOne(id);
  }
}