import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FollowsService } from './follows.service';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('FollowsService', () => {
  let service: FollowsService;
  let followRepository: Repository<Follow>;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let notificationsService: NotificationsService;

  const mockFollowRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
    exists: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    exists: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockNotificationsService = {
    createWithTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
    followRepository = module.get<Repository<Follow>>(getRepositoryToken(Follow));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('follow', () => {
    const followerId = 'follower-id';
    const followingId = 'following-id';

    it('should create a follow relationship successfully', async () => {
      mockDataSource.transaction.mockImplementation(async (fn) => {
        const mockManager = {
          exists: jest.fn().mockResolvedValue(true),
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue({ followerId, followingId }),
          save: jest.fn().mockResolvedValue({ id: 'follow-id', followerId, followingId }),
        };
        return fn(mockManager);
      });

      await service.follow(followerId, followingId);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockNotificationsService.createWithTransaction).toHaveBeenCalled();
    });

    it('should throw error when trying to follow yourself', async () => {
      await expect(service.follow(followerId, followerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when already following', async () => {
      mockDataSource.transaction.mockImplementation(async (fn) => {
        const mockManager = {
          exists: jest.fn().mockResolvedValue(true),
          findOne: jest.fn().mockResolvedValue({ id: 'existing-follow' }),
        };
        return fn(mockManager);
      });

      await expect(service.follow(followerId, followingId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unfollow', () => {
    const followerId = 'follower-id';
    const followingId = 'following-id';

    it('should remove follow relationship successfully', async () => {
      const mockFollow = { id: 'follow-id', followerId, followingId };
      
      mockDataSource.transaction.mockImplementation(async (fn) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(mockFollow),
          remove: jest.fn().mockResolvedValue(mockFollow),
        };
        return fn(mockManager);
      });

      await service.unfollow(followerId, followingId);

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw error when follow relationship not found', async () => {
      mockDataSource.transaction.mockImplementation(async (fn) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(null),
        };
        return fn(mockManager);
      });

      await expect(service.unfollow(followerId, followingId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFollowInfo', () => {
    const userId = 'user-id';
    const currentUserId = 'current-user-id';

    it('should return follow info with isFollowedByUser true when following', async () => {
      mockFollowRepository.count.mockResolvedValueOnce(10); // followers
      mockFollowRepository.count.mockResolvedValueOnce(5);  // following
      
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getSql: jest.fn().mockReturnValue('SELECT * FROM follows'),
        getOne: jest.fn().mockResolvedValue({ id: 'follow-id', followerId: currentUserId, followingId: userId }),
      };
      
      mockFollowRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockFollowRepository.query.mockResolvedValue([{ id: 'follow-id' }]);

      const result = await service.getFollowInfo(userId, currentUserId);

      expect(result).toEqual({
        followersCount: 10,
        followingCount: 5,
        isFollowedByUser: true,
      });
    });

    it('should return follow info with isFollowedByUser false when not following', async () => {
      mockFollowRepository.count.mockResolvedValueOnce(10); // followers
      mockFollowRepository.count.mockResolvedValueOnce(5);  // following
      
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getSql: jest.fn().mockReturnValue('SELECT * FROM follows'),
        getOne: jest.fn().mockResolvedValue(null),
      };
      
      mockFollowRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockFollowRepository.query.mockResolvedValue([]);

      const result = await service.getFollowInfo(userId, currentUserId);

      expect(result).toEqual({
        followersCount: 10,
        followingCount: 5,
        isFollowedByUser: false,
      });
    });

    it('should return isFollowedByUser false when no currentUserId', async () => {
      mockFollowRepository.count.mockResolvedValueOnce(10); // followers
      mockFollowRepository.count.mockResolvedValueOnce(5);  // following

      const result = await service.getFollowInfo(userId);

      expect(result).toEqual({
        followersCount: 10,
        followingCount: 5,
        isFollowedByUser: false,
      });
    });

    it('should return isFollowedByUser false when currentUserId equals userId', async () => {
      mockFollowRepository.count.mockResolvedValueOnce(10); // followers
      mockFollowRepository.count.mockResolvedValueOnce(5);  // following

      const result = await service.getFollowInfo(userId, userId);

      expect(result).toEqual({
        followersCount: 10,
        followingCount: 5,
        isFollowedByUser: false,
      });
    });
  });

  describe('isFollowing', () => {
    const followerId = 'follower-id';
    const followingId = 'following-id';

    it('should return true when follow relationship exists', async () => {
      mockFollowRepository.findOne.mockResolvedValue({ id: 'follow-id' });

      const result = await service.isFollowing(followerId, followingId);

      expect(result).toBe(true);
      expect(mockFollowRepository.findOne).toHaveBeenCalledWith({
        where: { followerId, followingId },
      });
    });

    it('should return false when follow relationship does not exist', async () => {
      mockFollowRepository.findOne.mockResolvedValue(null);

      const result = await service.isFollowing(followerId, followingId);

      expect(result).toBe(false);
    });
  });
});