# Admin Dashboard Architecture Design

## 📋 Executive Summary

This document outlines the comprehensive architecture for implementing an Admin Dashboard for the multi-user blog platform. The design prioritizes:
- **Preserving existing UI/UX** for user-facing features
- **Adding reporting functionality** with seamless UX integration
- **Creating new admin-only pages** with modern dashboard design
- **Maintaining system stability** through incremental implementation

## 🎯 Core Design Principles

1. **Non-Invasive Integration**: Add admin features without disrupting existing user workflows
2. **Role-Based Access Control**: Leverage existing Role enum (USER, ADMIN, MODERATOR)
3. **Progressive Enhancement**: Start with MVP features, expand incrementally
4. **Performance-First**: Use efficient queries and caching strategies
5. **Security by Design**: Implement audit logging and secure admin routes

## 🏗️ System Architecture

### Backend Architecture (NestJS)

```
backend/src/
├── admin/                    # New admin module
│   ├── dashboard/           # Dashboard analytics
│   ├── reports/            # Reporting system
│   ├── moderation/         # Content moderation
│   ├── analytics/          # Analytics aggregation
│   └── system/            # System monitoring
├── reports/                 # Reporting module (user-facing)
│   ├── entities/
│   │   └── report.entity.ts
│   ├── dto/
│   └── reports.service.ts
└── audit/                   # Audit logging module
    ├── entities/
    └── audit.service.ts
```

### Frontend Architecture (Next.js)

```
frontend/src/
├── app/
│   ├── admin/              # Admin-only routes
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── posts/
│   │   ├── reports/
│   │   └── analytics/
│   └── [existing routes]   # Unchanged
├── components/
│   ├── admin/              # Admin-specific components
│   └── reports/            # Report button integration
└── hooks/
    └── useReporting.ts     # Reporting functionality
```

## 📊 Database Schema Design

### New Entities

#### 1. Report Entity
```typescript
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType; // POST, COMMENT, USER

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason; // SPAM, HATE_SPEECH, INAPPROPRIATE, COPYRIGHT, OTHER

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  targetId: string; // ID of reported item

  @Column({ type: 'uuid' })
  reportedById: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus; // PENDING, REVIEWED, RESOLVED, DISMISSED

  @Column({ type: 'text', nullable: true })
  moderatorNotes: string;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 2. Analytics Event Entity
```typescript
@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  eventType: string; // page_view, post_view, user_signup, etc.

  @Column({ type: 'jsonb', nullable: true })
  eventData: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 3. Audit Log Entity
```typescript
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  action: string; // USER_BANNED, POST_DELETED, REPORT_RESOLVED, etc.

  @Column({ type: 'varchar' })
  entityType: string; // user, post, comment, report

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  previousData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newData: Record<string, any>;

  @Column({ type: 'uuid' })
  performedById: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 4. System Metrics Entity
```typescript
@Entity('system_metrics')
export class SystemMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  metricType: string; // api_response_time, error_rate, etc.

  @Column({ type: 'float' })
  value: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}
```

## 🔐 Security & Access Control

### Role-Based Permissions Matrix

| Feature | USER | MODERATOR | ADMIN |
|---------|------|-----------|-------|
| View own content | ✅ | ✅ | ✅ |
| Report content | ✅ | ✅ | ✅ |
| View admin dashboard | ❌ | ✅ (limited) | ✅ |
| Manage reports | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| View analytics | ❌ | ✅ (limited) | ✅ |
| System monitoring | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ✅ |

### Security Implementation

1. **Admin Route Protection**
   - Separate `/admin` routes with role guards
   - JWT validation with role checks
   - Rate limiting for admin endpoints

2. **Audit Logging**
   - Log all admin actions
   - Track IP addresses and user agents
   - Immutable audit trail

3. **Data Privacy**
   - Anonymize user data in analytics
   - GDPR compliance for data retention
   - Secure deletion procedures

## 🎨 UI/UX Integration

### User-Facing Report Feature

#### Report Button Integration (Non-Invasive)
```typescript
// Add to existing PostActions component
<DropdownMenu>
  <DropdownMenuTrigger>
    <MoreHorizontal className="h-4 w-4" />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {/* Existing menu items */}
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleReport}>
      <Flag className="mr-2 h-4 w-4" />
      Report Post
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Admin Dashboard Pages

#### 1. Dashboard Overview
- **URL**: `/admin/dashboard`
- **Components**:
  - KPI Cards (DAU, MAU, Posts, Comments)
  - Activity Charts
  - Recent Reports
  - System Health Status

#### 2. User Management
- **URL**: `/admin/users`
- **Features**:
  - User table with search/filter
  - Role management
  - Account status control
  - Activity history

#### 3. Content Management
- **URL**: `/admin/posts`
- **Features**:
  - Post/Comment moderation
  - Bulk actions
  - Content filters
  - Tag management

#### 4. Reports Center
- **URL**: `/admin/reports`
- **Features**:
  - Report queue
  - Quick actions
  - Report analytics
  - Auto-detection patterns

## 📈 Analytics & Monitoring

### Key Metrics to Track

#### User Metrics
- Daily/Monthly Active Users (DAU/MAU)
- User retention cohorts
- Signup/churn rates
- User engagement scores

#### Content Metrics
- Posts created per day
- Comments per post
- Popular tags/categories
- Content quality scores

#### System Metrics
- API response times
- Error rates by endpoint
- Database query performance
- File storage usage

### Monitoring Implementation
```typescript
// System health check endpoint
@Get('health')
async getSystemHealth() {
  return {
    status: 'healthy',
    services: {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      s3: await this.checkS3(),
    },
    metrics: {
      responseTime: this.getAverageResponseTime(),
      errorRate: this.getErrorRate(),
      activeUsers: this.getActiveUserCount(),
    }
  };
}
```

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create admin module structure
- [ ] Implement Report entity and service
- [ ] Add report buttons to existing UI
- [ ] Create basic admin dashboard page

### Phase 2: Core Features (Week 2)
- [ ] User management interface
- [ ] Content moderation tools
- [ ] Report processing workflow
- [ ] Basic analytics collection

### Phase 3: Advanced Features (Week 3)
- [ ] Advanced analytics dashboard
- [ ] System monitoring
- [ ] Audit logging
- [ ] Automated moderation rules

### Phase 4: Polish & Testing (Week 4)
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Security audit

## 🧪 Testing Strategy

### Unit Tests
- Service layer logic
- Entity validations
- Guard implementations
- Utility functions

### Integration Tests
- API endpoints
- Database operations
- Role-based access
- Report workflow

### E2E Tests
- Admin login flow
- Report submission
- Moderation workflow
- Analytics data flow

## 📝 API Endpoints Design

### Admin API Routes

#### Dashboard
- `GET /api/v1/admin/dashboard/stats` - Get dashboard statistics
- `GET /api/v1/admin/dashboard/recent-activity` - Recent activity feed

#### Users
- `GET /api/v1/admin/users` - List users with filters
- `PATCH /api/v1/admin/users/:id/role` - Update user role
- `PATCH /api/v1/admin/users/:id/status` - Update user status
- `GET /api/v1/admin/users/:id/activity` - User activity log

#### Content
- `GET /api/v1/admin/posts` - List posts with filters
- `PATCH /api/v1/admin/posts/:id/status` - Update post status
- `DELETE /api/v1/admin/posts/:id` - Delete post (soft delete)
- `GET /api/v1/admin/posts/popular` - Popular posts

#### Reports
- `GET /api/v1/admin/reports` - List reports
- `PATCH /api/v1/admin/reports/:id/status` - Update report status
- `POST /api/v1/admin/reports/:id/action` - Take action on report

#### Analytics
- `GET /api/v1/admin/analytics/users` - User analytics
- `GET /api/v1/admin/analytics/content` - Content analytics
- `GET /api/v1/admin/analytics/system` - System analytics

### User-Facing Report API
- `POST /api/v1/reports` - Submit a report
- `GET /api/v1/reports/my-reports` - User's own reports

## 🔧 Technical Considerations

### Performance Optimization
- Use database indexes for admin queries
- Implement caching for analytics data
- Pagination for large datasets
- Lazy loading for dashboard widgets

### Scalability
- Separate read replicas for analytics
- Queue system for report processing
- Background jobs for metric aggregation
- CDN for admin static assets

### Monitoring & Alerts
- Error tracking (Sentry integration)
- Performance monitoring (APM)
- Uptime monitoring
- Alert thresholds for critical metrics

## 📚 Dependencies

### Backend
- `@nestjs/throttler` - Rate limiting
- `@nestjs/cache-manager` - Caching
- `bull` - Queue management
- `node-cron` - Scheduled tasks

### Frontend
- `shadcn/ui` - UI components
- `recharts` - Charts and graphs
- `tanstack/react-table` - Data tables
- `react-hook-form` - Form management
- `zod` - Schema validation

## 🎯 Success Metrics

1. **Technical Metrics**
   - Admin dashboard load time < 2s
   - Report processing time < 5s
   - 99.9% uptime for admin services

2. **Business Metrics**
   - 50% reduction in moderation response time
   - 80% of reports resolved within 24h
   - 30% improvement in content quality score

3. **User Experience Metrics**
   - < 3 clicks to report content
   - < 5s to take moderation action
   - Intuitive dashboard navigation

## 🚨 Risk Mitigation

1. **Performance Impact**
   - Risk: Admin queries slow down main app
   - Mitigation: Separate database connections, read replicas

2. **Security Breach**
   - Risk: Unauthorized admin access
   - Mitigation: 2FA, audit logs, IP whitelisting

3. **False Positives**
   - Risk: Legitimate content flagged
   - Mitigation: Manual review queue, appeal process

4. **Data Privacy**
   - Risk: GDPR violations
   - Mitigation: Data anonymization, retention policies