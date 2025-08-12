import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blog } from './entities/blog.entity';
import { CreateBlogDto } from './dto/create-blog.dto';
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
      userId: user.id,
      owner: user
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

  async findOneBySlug(slug: string): Promise<Blog> {
    const blog = await this.blogRepository.findOne({
      where: { slug },
      relations: ['owner']
    });

    if (!blog) {
      throw new NotFoundException('블로그를 찾을 수 없습니다.');
    }

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
}