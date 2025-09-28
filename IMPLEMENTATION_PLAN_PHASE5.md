# 📝 멀티테넌트 SaaS 플랫폼 - Phase 5 구현 계획

## 🎯 Phase 5: 테스트 및 배포 전략 (Day 9-10)

### 1️⃣ 단위 테스트 (Unit Testing)

#### A. Backend Unit Tests - Domain Layer
**파일**: `backend/src/core/domain/organization/organization.aggregate.spec.ts`
```typescript
import { OrganizationAggregate } from './organization.aggregate';
import { OrganizationType } from './organization.types';
import { SubscriptionPlan } from '../subscription/subscription.types';

describe('OrganizationAggregate', () => {
  let organization: OrganizationAggregate;

  beforeEach(() => {
    organization = new OrganizationAggregate({
      id: 'org-123',
      type: OrganizationType.TEAM,
      ownerId: 'user-123',
      subscription: {
        planCode: 'SUBSCRIPTION_PRO',
        memberLimit: 10,
        blogLimit: 10,
        storageLimit: 10240 // 10GB
      }
    });
  });

  describe('canAddMember', () => {
    it('should allow adding members within limit', () => {
      expect(organization.canAddMember(5)).toBe(true);
    });

    it('should prevent adding members beyond limit', () => {
      expect(organization.canAddMember(10)).toBe(false);
    });

    it('should handle unlimited plans correctly', () => {
      organization.subscription.memberLimit = -1;
      expect(organization.canAddMember(1000)).toBe(true);
    });
  });

  describe('canCreateBlog', () => {
    it('should enforce blog creation limits', () => {
      expect(organization.canCreateBlog(5)).toBe(true);
      expect(organization.canCreateBlog(10)).toBe(false);
    });
  });

  describe('upgradeSubscription', () => {
    it('should allow valid plan upgrades', () => {
      const newPlan = {
        code: 'SUBSCRIPTION_BUSINESS',
        requiresTeam: true
      };

      const result = organization.upgradeSubscription(newPlan);
      expect(result.isSuccess).toBe(true);
    });

    it('should prevent personal orgs from team plans', () => {
      organization.type = OrganizationType.PERSONAL;
      const teamPlan = {
        code: 'SUBSCRIPTION_BUSINESS',
        requiresTeam: true
      };

      const result = organization.upgradeSubscription(teamPlan);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Personal organization');
    });
  });
});
```

#### B. Backend Unit Tests - Service Layer
**파일**: `backend/src/organizations/services/organizations.service.spec.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationsService } from './organizations.service';
import { OrganizationEntity } from '../entities/organization.entity';
import { OrganizationMembershipEntity } from '../entities/organization-membership.entity';
import { CacheService } from '@/infrastructure/cache/cache.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let orgRepository: jest.Mocked<Repository<OrganizationEntity>>;
  let membershipRepository: jest.Mocked<Repository<OrganizationMembershipEntity>>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(OrganizationEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrganizationMembershipEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    orgRepository = module.get(getRepositoryToken(OrganizationEntity));
    membershipRepository = module.get(getRepositoryToken(OrganizationMembershipEntity));
    cacheService = module.get(CacheService);
  });

  describe('createOrganization', () => {
    it('should create organization and owner membership', async () => {
      const userId = 'user-123';
      const createDto = {
        name: 'Test Org',
        slug: 'test-org',
        type: 'team' as const,
      };

      const mockOrg = { id: 'org-123', ...createDto, ownerId: userId };
      const mockMembership = {
        id: 'membership-123',
        userId,
        organizationId: 'org-123',
        roleId: 1,
      };

      orgRepository.create.mockReturnValue(mockOrg as any);
      orgRepository.save.mockResolvedValue(mockOrg as any);
      membershipRepository.create.mockReturnValue(mockMembership as any);
      membershipRepository.save.mockResolvedValue(mockMembership as any);

      const result = await service.createOrganization(userId, createDto);

      expect(orgRepository.create).toHaveBeenCalledWith({
        ...createDto,
        ownerId: userId,
      });
      expect(orgRepository.save).toHaveBeenCalledWith(mockOrg);
      expect(membershipRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockOrg);
    });

    it('should handle duplicate slug error', async () => {
      const userId = 'user-123';
      const createDto = {
        name: 'Test Org',
        slug: 'existing-slug',
        type: 'team' as const,
      };

      orgRepository.save.mockRejectedValue({
        code: '23505', // PostgreSQL unique violation
      });

      await expect(
        service.createOrganization(userId, createDto)
      ).rejects.toThrow('Organization slug already exists');
    });
  });

  describe('inviteMember', () => {
    it('should create pending membership invitation', async () => {
      const orgId = 'org-123';
      const invitedBy = 'user-123';
      const inviteDto = {
        email: 'newmember@example.com',
        roleId: 3,
      };

      membershipRepository.save.mockResolvedValue({
        id: 'membership-456',
        organizationId: orgId,
        ...inviteDto,
        invitedById: invitedBy,
        invitedAt: new Date(),
      } as any);

      const result = await service.inviteMember(orgId, invitedBy, inviteDto);

      expect(membershipRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          invitedById: invitedBy,
          ...inviteDto,
        })
      );
    });
  });
});
```

#### C. Frontend Unit Tests - Store
**파일**: `frontend/src/stores/__tests__/organization.store.test.ts`
```typescript
import { renderHook, act } from '@testing-library/react';
import { useOrganizationStore } from '../organization.store';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client');

describe('OrganizationStore', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('loadOrganizations', () => {
    it('should load and set organizations', async () => {
      const mockOrganizations = [
        { id: '1', name: 'Personal', type: 'personal' },
        { id: '2', name: 'Team', type: 'team' }
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          organizations: mockOrganizations,
          active: mockOrganizations[0]
        }
      });

      const { result } = renderHook(() => useOrganizationStore());

      await act(async () => {
        await result.current.loadOrganizations();
      });

      expect(result.current.organizations).toEqual(mockOrganizations);
      expect(result.current.currentOrganization).toEqual(mockOrganizations[0]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle loading error', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOrganizationStore());

      await act(async () => {
        try {
          await result.current.loadOrganizations();
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.organizations).toEqual([]);
    });
  });

  describe('switchOrganization', () => {
    it('should switch to different organization', async () => {
      const newOrg = { id: '2', name: 'New Org', type: 'team' };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { organization: newOrg }
      });

      // Mock window.location.href
      delete window.location;
      window.location = { href: '' } as any;

      const { result } = renderHook(() => useOrganizationStore());

      await act(async () => {
        await result.current.switchOrganization('2');
      });

      expect(apiClient.post).toHaveBeenCalledWith('/organizations/switch', {
        orgId: '2'
      });
      expect(result.current.currentOrganization).toEqual(newOrg);
    });
  });

  describe('permission helpers', () => {
    it('should check permissions correctly', () => {
      const { result } = renderHook(() => useOrganizationStore());

      act(() => {
        result.current.setCurrentOrganization({
          id: '1',
          name: 'Test Org',
          type: 'team',
          role: 'admin',
          permissions: ['create_blog', 'invite_members']
        });
      });

      expect(result.current.hasPermission('create_blog')).toBe(true);
      expect(result.current.hasPermission('delete_org')).toBe(false);
      expect(result.current.canCreateBlog()).toBe(true);
      expect(result.current.canInviteMembers()).toBe(true);
      expect(result.current.canManageBilling()).toBe(false);
    });
  });
});
```

### 2️⃣ 통합 테스트 (Integration Testing)

#### A. API Integration Tests
**파일**: `backend/test/integration/organizations.e2e-spec.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';

describe('Organizations E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // Create test user and get auth token
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        username: 'testuser',
      });

    authToken = signupResponse.body.accessToken;
    userId = signupResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await dataSource.query('DELETE FROM users WHERE email = $1', ['test@example.com']);
    await app.close();
  });

  describe('POST /organizations', () => {
    it('should create new organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Organization',
          slug: 'test-org',
          type: 'team',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Organization');
      expect(response.body.slug).toBe('test-org');
      expect(response.body.type).toBe('team');

      organizationId = response.body.id;
    });

    it('should reject duplicate slug', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Another Org',
          slug: 'test-org', // Same slug
          type: 'team',
        })
        .expect(409);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Test Organization',
          slug: 'test-org-2',
          type: 'team',
        })
        .expect(401);
    });
  });

  describe('GET /organizations/my-organizations', () => {
    it('should return user organizations', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations/my-organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('organizations');
      expect(response.body.organizations).toBeInstanceOf(Array);
      expect(response.body.organizations.length).toBeGreaterThan(0);

      // Should have personal org and created team org
      const personalOrg = response.body.organizations.find(
        (org: any) => org.type === 'personal'
      );
      const teamOrg = response.body.organizations.find(
        (org: any) => org.type === 'team'
      );

      expect(personalOrg).toBeDefined();
      expect(teamOrg).toBeDefined();
    });
  });

  describe('POST /organizations/:id/invite', () => {
    it('should invite member to organization', async () => {
      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/invite`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          email: 'invited@example.com',
          roleId: 3, // Editor role
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('invited@example.com');
      expect(response.body.accepted).toBe(false);
    });

    it('should require owner or admin role', async () => {
      // Create another user
      const signup2 = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'member@example.com',
          password: 'Test123!@#',
          username: 'member',
        });

      const memberToken = signup2.body.accessToken;

      // Try to invite as non-admin
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/invite`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          email: 'another@example.com',
          roleId: 3,
        })
        .expect(403);
    });
  });

  describe('POST /organizations/switch', () => {
    it('should switch active organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations/switch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId,
        })
        .expect(200);

      expect(response.body.message).toBe('Organization switched successfully');
      expect(response.body.organization.id).toBe(organizationId);
    });

    it('should reject switching to unauthorized org', async () => {
      await request(app.getHttpServer())
        .post('/organizations/switch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: 'unauthorized-org-id',
        })
        .expect(403);
    });
  });
});
```

#### B. Subscription Flow Integration Test
**파일**: `backend/test/integration/subscription-flow.e2e-spec.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import Stripe from 'stripe';

describe('Subscription Flow E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let organizationId: string;
  let stripe: Stripe;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    // Setup test user and organization
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'subscription-test@example.com',
        password: 'Test123!@#',
        username: 'subtest',
      });

    authToken = signupResponse.body.accessToken;
    organizationId = signupResponse.body.user.defaultOrganizationId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Subscription Upgrade Flow', () => {
    let paymentMethodId: string;

    beforeAll(async () => {
      // Create test payment method in Stripe
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_visa', // Test token
        },
      });
      paymentMethodId = paymentMethod.id;
    });

    it('should start with free plan', async () => {
      const response = await request(app.getHttpServer())
        .get('/subscriptions/current')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200);

      expect(response.body.planRole.code).toBe('SUBSCRIPTION_FREE');
      expect(response.body.status).toBe('active');
    });

    it('should upgrade to pro plan', async () => {
      const response = await request(app.getHttpServer())
        .post('/subscriptions/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          planCode: 'SUBSCRIPTION_PRO',
          billingCycle: 'monthly',
          paymentMethodId,
        })
        .expect(200);

      expect(response.body.planRole.code).toBe('SUBSCRIPTION_PRO');
      expect(response.body.status).toBe('active');
      expect(response.body.billingCycle).toBe('monthly');
    });

    it('should track usage correctly', async () => {
      // Create a blog post to increment usage
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          title: 'Test Post',
          content: 'Test content',
        })
        .expect(201);

      // Check usage
      const response = await request(app.getHttpServer())
        .get('/subscriptions/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200);

      expect(response.body.posts.used).toBeGreaterThan(0);
      expect(response.body.posts.limit).toBe(200); // Pro plan limit
    });

    it('should handle downgrade request', async () => {
      const response = await request(app.getHttpServer())
        .post('/subscriptions/downgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          planCode: 'SUBSCRIPTION_BASIC',
        })
        .expect(200);

      expect(response.body.message).toContain('scheduled for end of billing period');
    });

    it('should cancel subscription', async () => {
      const response = await request(app.getHttpServer())
        .post('/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          reason: 'Testing cancellation',
        })
        .expect(200);

      expect(response.body.message).toContain('canceled');
      expect(response.body.subscription.status).toBe('canceled');
    });
  });
});
```

### 3️⃣ 성능 테스트 (Performance Testing)

#### A. Load Testing with K6
**파일**: `backend/test/performance/load-test.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.01'], // Error rate must be below 1%
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Test data
const testUsers = [];
for (let i = 0; i < 1000; i++) {
  testUsers.push({
    email: `perf-user-${i}@example.com`,
    password: 'Test123!@#',
    username: `perfuser${i}`,
  });
}

export function setup() {
  // Create test users
  const signupPromises = testUsers.slice(0, 10).map(user => {
    const response = http.post(`${BASE_URL}/auth/signup`, JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
    });

    return JSON.parse(response.body);
  });

  return signupPromises;
}

export default function (data) {
  const userIndex = Math.floor(Math.random() * 10);
  const user = data[userIndex];

  // Scenario 1: Login and fetch organizations
  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: testUsers[userIndex].email,
      password: testUsers[userIndex].password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const success = check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => JSON.parse(r.body).accessToken !== undefined,
  });

  errorRate.add(!success);

  if (!success) {
    return;
  }

  const token = JSON.parse(loginResponse.body).accessToken;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Scenario 2: Fetch organizations
  const orgsResponse = http.get(`${BASE_URL}/organizations/my-organizations`, {
    headers: authHeaders,
  });

  check(orgsResponse, {
    'organizations fetched': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 200,
  });

  // Scenario 3: Create a blog post
  const createPostResponse = http.post(
    `${BASE_URL}/posts`,
    JSON.stringify({
      title: `Performance Test Post ${Date.now()}`,
      content: 'This is a performance test post content.',
      isPublic: true,
    }),
    {
      headers: authHeaders,
    }
  );

  check(createPostResponse, {
    'post created': (r) => r.status === 201,
  });

  // Scenario 4: List blog posts with pagination
  const listPostsResponse = http.get(`${BASE_URL}/posts?page=1&limit=10`, {
    headers: authHeaders,
  });

  check(listPostsResponse, {
    'posts listed': (r) => r.status === 200,
    'has posts array': (r) => Array.isArray(JSON.parse(r.body).posts),
  });

  sleep(1); // Wait 1 second between iterations
}

export function teardown(data) {
  // Clean up test data
  console.log('Cleaning up test data...');
}
```

#### B. Database Query Performance Test
**파일**: `backend/test/performance/database-performance.spec.ts`
```typescript
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';

describe('Database Performance', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('Query Performance', () => {
    it('should execute complex join query under 100ms', async () => {
      const startTime = Date.now();

      const result = await dataSource.query(`
        SELECT
          o.id,
          o.name,
          o.slug,
          COUNT(DISTINCT om.user_id) as member_count,
          COUNT(DISTINCT b.id) as blog_count,
          s.status as subscription_status,
          r.display_name as plan_name
        FROM organizations o
        LEFT JOIN organization_memberships om ON o.id = om.organization_id
        LEFT JOIN blogs b ON o.id = b.organization_id
        LEFT JOIN subscriptions s ON o.id = s.organization_id
        LEFT JOIN roles r ON s.plan_role_id = r.id
        WHERE o.is_active = true
        GROUP BY o.id, o.name, o.slug, s.status, r.display_name
        LIMIT 100
      `);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle concurrent queries efficiently', async () => {
      const queries = Array(50).fill(null).map(() =>
        dataSource.query('SELECT COUNT(*) FROM users')
      );

      const startTime = Date.now();
      await Promise.all(queries);
      const duration = Date.now() - startTime;

      // 50 concurrent queries should complete under 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should use indexes effectively', async () => {
      const explainResult = await dataSource.query(`
        EXPLAIN ANALYZE
        SELECT * FROM organizations
        WHERE slug = 'test-org' AND is_active = true
      `);

      // Check if index is being used
      const plan = explainResult[0]['QUERY PLAN'];
      expect(plan).toContain('Index Scan');
    });
  });

  describe('Cache Performance', () => {
    it('should improve query performance with caching', async () => {
      // First query (cache miss)
      const start1 = Date.now();
      await dataSource.query('SELECT * FROM roles WHERE is_active = true');
      const duration1 = Date.now() - start1;

      // Second query (should hit cache)
      const start2 = Date.now();
      await dataSource.query('SELECT * FROM roles WHERE is_active = true');
      const duration2 = Date.now() - start2;

      // Cached query should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });
  });
});
```

### 4️⃣ 보안 테스트 (Security Testing)

#### A. Security Test Suite
**파일**: `backend/test/security/security.e2e-spec.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('Security Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: "admin' OR '1'='1",
          password: "password' OR '1'='1",
        })
        .expect(401);
    });

    it('should prevent SQL injection in search', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts/search')
        .query({ q: "'; DROP TABLE posts; --" })
        .expect(200);

      // Should return empty results, not cause error
      expect(response.body.posts).toEqual([]);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize user input', async () => {
      const maliciousContent = '<script>alert("XSS")</script>';

      const response = await request(app.getHttpServer())
        .post('/posts')
        .send({
          title: maliciousContent,
          content: maliciousContent,
        })
        .expect(201);

      // Content should be sanitized
      expect(response.body.title).not.toContain('<script>');
      expect(response.body.content).not.toContain('<script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(101).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/v1/posts')
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);

      // Should have at least one 429 response
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Security', () => {
    it('should reject weak passwords', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'weak@example.com',
          password: '123456',
          username: 'weakuser',
        })
        .expect(400);
    });

    it('should invalidate tokens after logout', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
        });

      const token = loginResponse.body.accessToken;

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use token after logout
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('Tenant Isolation', () => {
    it('should prevent cross-tenant data access', async () => {
      // Create two users with separate organizations
      const user1 = await createTestUser('tenant1@example.com');
      const user2 = await createTestUser('tenant2@example.com');

      // User1 creates a blog
      const blog1Response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${user1.token}`)
        .set('X-Organization-Id', user1.orgId)
        .send({
          name: 'User1 Blog',
          slug: 'user1-blog',
        })
        .expect(201);

      // User2 tries to access User1's blog
      await request(app.getHttpServer())
        .get(`/blogs/${blog1Response.body.id}`)
        .set('Authorization', `Bearer ${user2.token}`)
        .set('X-Organization-Id', user2.orgId)
        .expect(403);
    });
  });
});

async function createTestUser(email: string) {
  // Helper function to create test users
  // Implementation omitted for brevity
  return { token: 'test-token', orgId: 'test-org-id' };
}
```

### 5️⃣ CI/CD 파이프라인

#### A. GitHub Actions Workflow
**파일**: `.github/workflows/ci-cd.yml`
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18.x'
  POSTGRES_VERSION: '14'
  REDIS_VERSION: '7'

jobs:
  # 1. Code Quality Check
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: |
          cd backend && pnpm lint
          cd ../frontend && pnpm lint

      - name: Run Prettier check
        run: pnpm format:check

  # 2. Type Check
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: TypeScript check
        run: |
          cd backend && pnpm tsc --noEmit
          cd ../frontend && pnpm tsc --noEmit

  # 3. Unit Tests
  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run backend tests
        run: cd backend && pnpm test:cov

      - name: Run frontend tests
        run: cd frontend && pnpm test:cov

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  # 4. Integration Tests
  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:${{ env.POSTGRES_VERSION }}
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:${{ env.REDIS_VERSION }}
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
        run: cd backend && pnpm migration:run

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
          REDIS_HOST: localhost
          REDIS_PORT: 6379
        run: cd backend && pnpm test:e2e

  # 5. Build
  build:
    needs: [lint, type-check, test-unit]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build backend
        run: cd backend && pnpm build

      - name: Build frontend
        run: cd frontend && pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            backend/dist
            frontend/.next

  # 6. Deploy to Staging
  deploy-staging:
    needs: [build, test-integration]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v3

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add deployment script here

      - name: Run smoke tests
        run: |
          echo "Running smoke tests on staging..."
          # Add smoke test script here

  # 7. Deploy to Production
  deploy-production:
    needs: [build, test-integration]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts

      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Add production deployment script here

      - name: Health check
        run: |
          echo "Running health checks..."
          # Add health check script here

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 6️⃣ 배포 스크립트

#### A. Docker Compose for Production
**파일**: `docker-compose.prod.yml`
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USERNAME}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend Next.js
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    environment:
      NODE_ENV: production
    depends_on:
      - backend
    networks:
      - app_network
    restart: unless-stopped

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
    networks:
      - app_network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  app_network:
    driver: bridge
```

#### B. Kubernetes Deployment
**파일**: `k8s/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blog-platform-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blog-backend
  template:
    metadata:
      labels:
        app: blog-backend
    spec:
      containers:
      - name: backend
        image: your-registry/blog-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: blog-secrets
              key: database-url
        - name: REDIS_HOST
          value: redis-service
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: blog-secrets
              key: redis-password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---

apiVersion: v1
kind: Service
metadata:
  name: blog-backend-service
  namespace: production
spec:
  selector:
    app: blog-backend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP

---

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: blog-backend-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: blog-platform-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 📊 테스트 커버리지 목표

### 목표 커버리지:
- **Unit Tests**: 80% 이상
- **Integration Tests**: 70% 이상
- **E2E Tests**: 핵심 시나리오 100%

### 테스트 분류:
- **Critical Path**: 100% 커버리지 필수
  - 인증/인가
  - 결제 처리
  - 데이터 접근 제어

- **Business Logic**: 90% 이상
  - 도메인 로직
  - 서비스 계층

- **UI Components**: 70% 이상
  - 주요 컴포넌트
  - 사용자 인터랙션

## 🚀 배포 전략

### Blue-Green 배포:
1. Green 환경에 새 버전 배포
2. 테스트 및 검증
3. 트래픽 전환
4. Blue 환경 백업 유지

### 롤백 계획:
1. 데이터베이스 백업
2. 이전 버전 컨테이너 보관
3. 빠른 전환 가능한 라우팅
4. 모니터링 및 알림

## ⚠️ 배포 체크리스트

- [ ] 모든 테스트 통과
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 환경 변수 설정 확인
- [ ] SSL 인증서 유효성
- [ ] 백업 시스템 준비
- [ ] 모니터링 대시보드 설정
- [ ] 롤백 계획 검증
- [ ] 팀 커뮤니케이션