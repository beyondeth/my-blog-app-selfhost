import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { File } from '../files/entities/file.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { User } from '../users/entities/user.entity';
import { FilesService } from '../files/files.service';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';
import { Role } from '../common/enums/role.enum';

describe('PostsService - Image Optimization', () => {
  let service: PostsService;
  let postsRepository: jest.Mocked<Repository<Post>>;
  let filesRepository: jest.Mocked<Repository<File>>;
  let blogsRepository: jest.Mocked<Repository<Blog>>;
  let filesService: jest.Mocked<FilesService>;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    role: Role.USER,
    profileImage: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockBlog = {
    id: 'blog-1',
    name: 'Test Blog',
    slug: 'test-blog',
    userId: 'user-1',
    description: 'Test blog description',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTempImageFile: File = {
    id: 'file-1',
    originalName: 'test-image.png',
    fileName: 'test-uuid.png',
    fileKey: 'uploads/images/test-uuid.png',
    fileUrl: 'uploads/images/test-uuid.png',
    fileSize: 1024000,
    mimeType: 'image/png',
    fileType: 'image',
    userId: 'user-1',
    user: null,
    contextId: null,
    context: null,
    s3Bucket: null,
    s3Region: null,
    checksum: null,
    isOptimized: false,
    metadata: {},
    expiresAt: null,
    posts: Promise.resolve([]),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(File),
          useValue: {
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Blog),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: FilesService,
          useValue: {
            deleteFile: jest.fn(),
          },
        },
        {
          provide: MarkdownRendererService,
          useValue: {
            convertToHtml: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postsRepository = module.get(getRepositoryToken(Post));
    filesRepository = module.get(getRepositoryToken(File));
    blogsRepository = module.get(getRepositoryToken(Blog));
    filesService = module.get(FilesService);
  });

  describe('임시 파일 삭제 테스트', () => {
    it('게시글 생성 후 백그라운드에서 임시 파일이 최적화되고 정리되어야 함', async () => {
      // Arrange
      const createPostDto = {
        title: 'Test Post',
        content: '<p>Test content with image</p>',
        attachedFileIds: ['file-1'],
        category: 'Test Category',
      };

      const mockPost = {
        id: 'post-1',
        title: 'Test Post',
        content: '<p>Test content with image</p>',
        slug: 'test-post-uuid',
        attachedFiles: [mockTempImageFile],
      };

      // Mock blog exists
      blogsRepository.findOne.mockResolvedValue(mockBlog as any);
      
      // Mock post creation
      postsRepository.create.mockReturnValue(mockPost as any);
      postsRepository.save.mockResolvedValue(mockPost as any);
      
      // Mock file operations
      filesRepository.find.mockImplementation((options: any) => {
        if (options?.where?.status === 'temp') {
          return Promise.resolve([{
            ...mockTempImageFile,
            posts: Promise.resolve([mockPost]), // 이 포스트에 연결된 파일
          }]);
        }
        return Promise.resolve([]);
      });

      filesRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await service.create(createPostDto, mockUser);

      // 백그라운드 작업이 완료될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('post-1');

      // 임시 파일 조회가 호출되었는지 확인
      expect(filesRepository.find).toHaveBeenCalledWith({
        where: { 
          status: 'temp',
          fileType: 'image'
        },
        relations: ['posts']
      });

      // 파일 상태가 순차적으로 업데이트되었는지 확인
      expect(filesRepository.update).toHaveBeenCalledWith('file-1', { status: 'processing' });
      expect(filesRepository.update).toHaveBeenCalledWith('file-1', { 
        status: 'published',
        optimizedUrl: expect.stringMatching(/\.webp$/), // WebP 확장자로 끝나는 URL
        metadata: expect.objectContaining({
          optimized: true,
          optimizedAt: expect.any(String),
          originalFormat: 'image/png',
          optimizedFormat: 'image/webp'
        })
      });

      // 최소 2번 호출 (processing -> published)
      expect(filesRepository.update).toHaveBeenCalledTimes(2);
    }, 10000); // 10초 타임아웃

    it('최적화 실패 시 파일이 temp 상태로 되돌아가야 함', async () => {
      // Arrange
      const createPostDto = {
        title: 'Test Post',
        content: '<p>Test content</p>',
        category: 'Test Category',
      };

      const mockPost = { id: 'post-1', title: 'Test Post' };

      blogsRepository.findOne.mockResolvedValue(mockBlog as any);
      postsRepository.create.mockReturnValue(mockPost as any);
      postsRepository.save.mockResolvedValue(mockPost as any);

      // 임시 파일이 있지만 업데이트 실패 시뮬레이션
      filesRepository.find.mockResolvedValue([{
        ...mockTempImageFile,
        posts: Promise.resolve([mockPost]),
      }]);

      // 첫 번째 업데이트는 성공, 두 번째 업데이트에서 실패
      filesRepository.update
        .mockResolvedValueOnce({ affected: 1 } as any) // processing으로 변경 성공
        .mockRejectedValueOnce(new Error('Update failed')); // published로 변경 실패

      // Act
      await service.create(createPostDto, mockUser);
      
      // 백그라운드 작업 완료 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Assert - 실패 시 복구 로직 확인
      expect(filesRepository.find).toHaveBeenCalledWith({
        where: { status: 'processing', fileType: 'image' }
      });
      
      // 실패한 파일들을 temp로 되돌렸는지 확인
      expect(filesRepository.update).toHaveBeenCalledWith(
        expect.any(String), 
        { status: 'temp' }
      );
    }, 10000);

    it('포스트에 연결된 이미지가 없으면 최적화를 건너뛰어야 함', async () => {
      // Arrange
      const createPostDto = {
        title: 'Text Only Post',
        content: '<p>No images here</p>',
        category: 'Test Category',
      };

      const mockPost = { id: 'post-1', title: 'Text Only Post' };

      blogsRepository.findOne.mockResolvedValue(mockBlog as any);
      postsRepository.create.mockReturnValue(mockPost as any);
      postsRepository.save.mockResolvedValue(mockPost as any);

      // 임시 파일이 없음
      filesRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.create(createPostDto, mockUser);

      // 백그라운드 작업 완료 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert
      expect(result).toBeDefined();
      
      // 임시 파일 조회는 했지만 업데이트는 하지 않음
      expect(filesRepository.find).toHaveBeenCalled();
      expect(filesRepository.update).not.toHaveBeenCalled();
    });
  });
});