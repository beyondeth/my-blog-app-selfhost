# 파일 시스템 마이그레이션 가이드

## 📋 목차
1. [개요](#개요)
2. [사전 준비](#사전-준비)
3. [마이그레이션 실행](#마이그레이션-실행)
4. [검증 및 모니터링](#검증-및-모니터링)
5. [롤백 절차](#롤백-절차)
6. [운영 가이드](#운영-가이드)

## 개요

이 문서는 파일 시스템 v1에서 v2로의 마이그레이션 절차를 설명합니다.

### 주요 변경사항
- **v1**: `uploads/{type}/{year}/{month}/{uuid}.ext`
- **v2**: `v2/users/{userId}/profile/avatar/{timestamp}_{uuid}_{purpose}.ext`

### 개선사항
- ✅ 컨텍스트 기반 파일 관리
- ✅ 사용자별 네임스페이스 격리
- ✅ 30일 보관 정책 구현
- ✅ 자동 정리 시스템
- ✅ 파일 버전 관리

## 사전 준비

### 1. 환경 변수 설정
```bash
# .env 파일
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=myblogdata84

# CDN 설정 (선택사항)
CDN_ENABLED=false
CDN_DOMAIN=cdn.yourdomain.com
```

### 2. 데이터베이스 백업
```bash
# PostgreSQL 백업
pg_dump -h localhost -U postgres -d myblog > backup_$(date +%Y%m%d).sql

# S3 버킷 백업 (AWS CLI 필요)
aws s3 sync s3://myblogdata84 ./s3-backup --exclude "v2/*"
```

### 3. 패키지 설치
```bash
cd backend
pnpm install
```

## 마이그레이션 실행

### 1. 데이터베이스 마이그레이션
```bash
# 마이그레이션 생성 확인
npm run migration:generate -- -n AddFileContextSystem

# 마이그레이션 실행
npm run migration:run
```

### 2. 파일 분석 (Dry Run)
```bash
# 현재 상태 분석
npm run migrate:files -- --dry-run

# 상세 분석
npm run migrate:files -- --dry-run --verbose
```

### 3. 실제 마이그레이션 실행
```bash
# 기본 실행 (배치 크기: 100)
npm run migrate:files:execute

# 커스텀 배치 크기
npm run migrate:files -- --execute --batch-size=50

# 상세 로그와 함께 실행
npm run migrate:files -- --execute --verbose
```

### 4. API를 통한 마이그레이션
```bash
# 마이그레이션 시작
curl -X POST http://localhost:3000/api/v1/files/migration/start \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 상태 확인
curl http://localhost:3000/api/v1/files/migration/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 통계 조회
curl http://localhost:3000/api/v1/files/migration/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 검증 및 모니터링

### 1. 마이그레이션 상태 확인
```bash
# 헬스 체크
curl http://localhost:3000/api/v1/files/migration/health

# 예상 응답
{
  "status": "healthy",
  "issues": []
}
```

### 2. 파일 시스템 통계
```sql
-- v1 vs v2 파일 수 확인
SELECT 
  CASE 
    WHEN file_key LIKE 'v2/%' THEN 'v2'
    ELSE 'v1'
  END as version,
  COUNT(*) as file_count,
  SUM(file_size) as total_size
FROM files
GROUP BY version;

-- 컨텍스트별 파일 분포
SELECT 
  context_type,
  purpose,
  COUNT(*) as count,
  SUM(file_count) as total_files
FROM file_contexts
GROUP BY context_type, purpose
ORDER BY count DESC;
```

### 3. 모니터링 대시보드
```bash
# Grafana 대시보드 import
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @monitoring/file-system-dashboard.json
```

## 롤백 절차

### 1. 긴급 롤백
```bash
# 마이그레이션 중단
curl -X POST http://localhost:3000/api/v1/files/migration/rollback \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 데이터베이스 롤백
npm run migration:revert
```

### 2. 데이터 복구
```bash
# S3 파일 복구
aws s3 sync ./s3-backup s3://myblogdata84 --exclude "v2/*"

# 데이터베이스 복구
psql -h localhost -U postgres -d myblog < backup_20240119.sql
```

## 운영 가이드

### 자동 정리 시스템

**크론 작업 (매일 새벽 2시)**
- 만료된 파일 삭제
- 고아 파일 정리
- 오래된 파일 아카이브

### 수동 정리
```bash
# 수동 정리 트리거
curl -X POST http://localhost:3000/api/v1/files/migration/cleanup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 사용자 할당량 확인
```bash
# 특정 사용자 할당량
curl "http://localhost:3000/api/v1/files/migration/quota?userId=USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 새로운 API 엔드포인트 (v2)

#### 프로필 이미지 업로드
```bash
# 아바타 업로드
curl -X POST http://localhost:3000/api/v2/files/profile/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@avatar.jpg"

# 커버 이미지 업로드
curl -X POST http://localhost:3000/api/v2/files/profile/cover \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@cover.jpg"
```

#### 포스트 이미지 업로드
```bash
curl -X POST http://localhost:3000/api/v2/files/posts/{postId}/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@image.jpg"
```

#### 블로그 브랜딩
```bash
# 로고 업로드
curl -X POST http://localhost:3000/api/v2/files/blogs/{blogId}/logo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@logo.png"

# 배너 업로드
curl -X POST http://localhost:3000/api/v2/files/blogs/{blogId}/banner \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@banner.jpg"
```

### 파일 라이프사이클

1. **업로드**: 파일이 S3에 업로드되고 DB에 기록
2. **활성**: 정상적으로 사용 중인 상태
3. **만료 예약**: 삭제 요청 시 30일 후 삭제 예약
4. **아카이브**: 6개월 이상 된 파일은 Glacier로 이동
5. **삭제**: 만료일 도달 시 완전 삭제

### 트러블슈팅

#### 마이그레이션 실패
```bash
# 에러 로그 확인
tail -f logs/migration-errors.log

# 특정 파일 재시도
curl -X POST http://localhost:3000/api/v1/files/migration/retry/{fileId} \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### S3 권한 문제
```json
// S3 버킷 정책 확인
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:user/USERNAME"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CopyObject"
      ],
      "Resource": "arn:aws:s3:::myblogdata84/*"
    }
  ]
}
```

#### 성능 최적화
```bash
# 배치 크기 조정 (네트워크 상황에 따라)
npm run migrate:files -- --execute --batch-size=200

# 병렬 처리 (주의: S3 API 제한)
npm run migrate:files -- --execute --parallel=5
```

## 체크리스트

### 마이그레이션 전
- [ ] 데이터베이스 백업 완료
- [ ] S3 버킷 백업 완료
- [ ] 환경 변수 설정 확인
- [ ] 테스트 환경에서 검증 완료

### 마이그레이션 중
- [ ] 마이그레이션 진행률 모니터링
- [ ] 에러 로그 확인
- [ ] S3 비용 모니터링

### 마이그레이션 후
- [ ] 모든 v1 파일 마이그레이션 확인
- [ ] 애플리케이션 정상 작동 확인
- [ ] 자동 정리 시스템 작동 확인
- [ ] 모니터링 대시보드 설정
- [ ] 백업 파일 정리 (30일 후)

## 참고 자료

- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html)
- [TypeORM Migration Guide](https://typeorm.io/migrations)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)