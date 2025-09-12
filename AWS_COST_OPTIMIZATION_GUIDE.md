# 💰 AWS 비용 최적화 가이드 - 월 5만원 예산 준수

## 📊 현재 비용 구조 (월간)

### 무료 티어 활용 (첫 12개월)
| 서비스 | 무료 한도 | 사용량 | 비용 |
|--------|----------|--------|------|
| EC2 t4g.micro | 750시간/월 | 720시간 | **무료** |
| RDS t3.micro | 750시간/월 | 720시간 | **무료** |
| S3 | 5GB, 20K GET | ~3GB | **무료** |
| CloudFront | 1TB 전송 | ~10GB | **무료** |
| 데이터 전송 | 15GB 아웃바운드 | ~7GB | **무료** |
| Route 53 | - | 1 호스팅 존 | **650원** |
| **월 총 비용** | | | **650원** |

### 무료 티어 종료 후 (13개월 이후)
| 서비스 | 사양 | 예상 비용 |
|--------|------|-----------|
| EC2 t4g.micro | 2 vCPU, 1GB | ~15,000원 |
| RDS t3.micro | 1 vCPU, 1GB | ~20,000원 |
| S3 + CloudFront | 최소 사용 | ~2,000원 |
| Route 53 | 호스팅 존 | 650원 |
| **월 총 비용** | | **~38,000원** |

## 🎯 비용 최적화 전략

### 1. EC2 최적화

#### a) 인스턴스 타입 선택
```yaml
추천: t4g.micro (ARM 기반)
- 비용: t3.micro 대비 20% 저렴
- 성능: ARM 아키텍처로 효율적
- 메모리: 1GB (충분함 - Redis 포함)

피해야 할 것:
- t3.small 이상 (비용 2배)
- x86 인스턴스 (ARM보다 비쌈)
```

#### b) Reserved Instance 활용
```yaml
12개월 이후 고려:
- 1년 약정 All Upfront: 35% 할인
- 월 15,000원 → 9,750원
- 연간 65,000원 절감
```

#### c) Spot Instance 활용 (개발/테스트)
```bash
# 개발 환경용 Spot Instance 요청
aws ec2 request-spot-instances \
    --instance-count 1 \
    --type "one-time" \
    --launch-specification file://spot-spec.json \
    --spot-price "0.003"  # 시간당 $0.003 (약 70% 할인)
```

### 2. RDS 최적화

#### a) 스토리지 최적화
```yaml
기본 설정:
- 20GB gp2 SSD (무료 티어)
- 자동 백업: 1일 보관 (무료)
- 스냅샷: 수동 1개/월

비용 절감:
- gp3로 변경 시 20% 저렴
- 백업 보관 기간 최소화
- 불필요한 스냅샷 삭제
```

#### b) 연결 풀링 최적화
```typescript
// backend/src/config/database.config.ts
export const databaseConfig = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 연결 풀 최적화
  extra: {
    max: 10,  // 최대 연결 수 (t3.micro는 20이 한계)
    min: 2,   // 최소 연결 수
    idleTimeoutMillis: 30000,  // 유휴 연결 타임아웃
    connectionTimeoutMillis: 2000,
  },
  
  // 쿼리 캐싱
  cache: {
    duration: 30000,  // 30초
    type: 'database',
  },
};
```

#### c) Read Replica 대신 캐싱
```yaml
비추천: RDS Read Replica
- 비용: 추가 20,000원/월
- 복잡도 증가

추천: Redis 캐싱
- 비용: EC2 내 메모리 사용 (무료)
- 성능: 더 빠름
- 구현: 간단
```

### 3. S3 & CloudFront 최적화

#### a) S3 스토리지 클래스
```yaml
이미지/파일 저장 전략:
1. 첫 30일: S3 Standard
2. 30일 후: S3 Standard-IA (50% 저렴)
3. 90일 후: S3 Glacier Instant (68% 저렴)

자동화 (Lifecycle Policy):
```

```json
{
  "Rules": [{
    "Id": "ArchiveOldFiles",
    "Status": "Enabled",
    "Transitions": [
      {
        "Days": 30,
        "StorageClass": "STANDARD_IA"
      },
      {
        "Days": 90,
        "StorageClass": "GLACIER_IR"
      }
    ]
  }]
}
```

#### b) CloudFront 캐싱 최적화
```yaml
캐시 정책:
- 이미지: 30일 (Cache-Control: max-age=2592000)
- CSS/JS: 7일 (Cache-Control: max-age=604800)
- API: 캐싱 안 함

압축 설정:
- Gzip 활성화
- 최소 압축 크기: 1KB
```

#### c) 이미지 최적화
```typescript
// backend/src/files/image-optimizer.service.ts
import * as sharp from 'sharp';

export class ImageOptimizer {
  async optimizeImage(buffer: Buffer, mimeType: string) {
    const optimizer = sharp(buffer);
    
    // 크기별 버전 생성
    const sizes = {
      thumbnail: { width: 200, height: 200 },
      medium: { width: 800, height: null },
      large: { width: 1920, height: null },
    };
    
    // WebP 변환 (30-50% 크기 감소)
    if (mimeType !== 'image/gif') {
      return optimizer
        .webp({ quality: 85 })
        .resize(sizes.medium.width)
        .toBuffer();
    }
    
    return buffer;
  }
}
```

### 4. 데이터 전송 최적화

#### a) 압축 활성화
```nginx
# nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;  # 균형잡힌 압축률
gzip_types text/plain text/css application/json 
           application/javascript text/xml application/xml+rss;

# 평균 70% 대역폭 절감
```

#### b) API 응답 최적화
```typescript
// 불필요한 데이터 제거
export class PostsController {
  @Get()
  async findAll(@Query() query: any) {
    const posts = await this.postsService.findAll(query);
    
    // 목록에서는 content 제외 (큰 필드)
    return posts.map(({ content, ...post }) => post);
  }
}
```

### 5. 모니터링 & 알림

#### a) CloudWatch 비용 알림
```bash
# 예산 알림 설정
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

```json
// budget.json
{
  "BudgetName": "MonthlyBlogBudget",
  "BudgetLimit": {
    "Amount": "40",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

#### b) 리소스 태깅
```bash
# 모든 리소스에 태그 추가
aws ec2 create-tags \
  --resources i-1234567890abcdef0 \
  --tags Key=Project,Value=Blog Key=Environment,Value=Production

# 태그별 비용 추적
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=TAG,Key=Project
```

### 6. 자동 비용 절감 스크립트

#### a) 야간 인스턴스 중지 (개발 환경)
```python
# stop_dev_instances.py
import boto3
from datetime import datetime

ec2 = boto3.client('ec2')

def stop_dev_instances():
    # 개발 인스턴스 중지 (23:00 - 07:00)
    current_hour = datetime.now().hour
    
    if current_hour >= 23 or current_hour < 7:
        response = ec2.stop_instances(
            InstanceIds=['i-dev-instance-id']
        )
        print(f"Stopped instances: {response}")
    
# Lambda로 실행 (CloudWatch Events 트리거)
```

#### b) 미사용 리소스 정리
```bash
#!/bin/bash
# cleanup_unused_resources.sh

# 미사용 EBS 볼륨 찾기
aws ec2 describe-volumes \
  --filters "Name=status,Values=available" \
  --query "Volumes[*].VolumeId" \
  --output text

# 오래된 스냅샷 삭제 (30일 이상)
aws ec2 describe-snapshots \
  --owner-ids self \
  --query "Snapshots[?StartTime<='$(date -d '30 days ago' --iso-8601)'].SnapshotId" \
  --output text | xargs -n1 aws ec2 delete-snapshot --snapshot-id

# 미사용 Elastic IP 해제
aws ec2 describe-addresses \
  --query "Addresses[?AssociationId==null].AllocationId" \
  --output text | xargs -n1 aws ec2 release-address --allocation-id
```

## 📈 비용 모니터링 대시보드

### CloudWatch Dashboard 설정
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Billing", "EstimatedCharges", {"stat": "Maximum"}]
        ],
        "period": 86400,
        "stat": "Maximum",
        "region": "us-east-1",
        "title": "일일 예상 비용"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/EC2", "CPUUtilization", {"stat": "Average"}],
          ["AWS/RDS", "CPUUtilization", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "ap-northeast-2",
        "title": "리소스 사용률"
      }
    }
  ]
}
```

## 🚨 비용 초과 시 긴급 조치

### Level 1: 예산 80% 도달 (40,000원)
1. CloudFront 캐시 TTL 2배 증가
2. RDS 자동 백업 보관 기간 단축 (7일 → 1일)
3. CloudWatch 로그 보관 기간 단축

### Level 2: 예산 90% 도달 (45,000원)
1. 개발/테스트 인스턴스 즉시 중지
2. S3 불필요한 파일 정리
3. CloudWatch 상세 모니터링 비활성화

### Level 3: 예산 100% 도달 (50,000원)
1. RDS Multi-AZ 비활성화 (있는 경우)
2. EC2 인스턴스 크기 축소 고려
3. CloudFront 일시 비활성화 (직접 S3 접근)

## 💡 추가 비용 절감 팁

### 1. AWS Free Tier 알림
```bash
# Free Tier 사용량 확인
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --filter file://free-tier-filter.json \
  --metrics UsageQuantity
```

### 2. Savings Plans 고려 (장기)
- Compute Savings Plans: 최대 66% 할인
- EC2 Instance Savings Plans: 최대 72% 할인
- 최소 약정: 1년

### 3. 크레딧 활용
- AWS Activate (스타트업): 최대 $100,000 크레딧
- AWS Educate (학생): $100 크레딧
- 프로모션 크레딧 확인

### 4. 리전 선택
```yaml
저렴한 리전:
- us-east-1 (버지니아): 가장 저렴
- us-west-2 (오레곤): 두 번째

비싼 리전:
- ap-northeast-2 (서울): 약 10-15% 비쌈
- ap-northeast-1 (도쿄): 약 20% 비쌈

권장: us-west-2 + CloudFront (지연시간 해결)
```

## 📊 월별 비용 추적 템플릿

| 항목 | 예산 | 실제 | 차이 |
|------|------|------|------|
| EC2 | 15,000원 | | |
| RDS | 20,000원 | | |
| S3 | 1,000원 | | |
| CloudFront | 1,000원 | | |
| Route 53 | 650원 | | |
| 데이터 전송 | 2,000원 | | |
| 기타 | 350원 | | |
| **합계** | **40,000원** | | |

## ✅ 체크리스트

### 일일 체크
- [ ] CloudWatch 비용 알림 확인
- [ ] 이상 트래픽 패턴 확인
- [ ] 미사용 리소스 확인

### 주간 체크
- [ ] 주간 비용 리포트 검토
- [ ] 리소스 사용률 분석
- [ ] 스케일링 필요성 검토

### 월간 체크
- [ ] 월별 비용 상세 분석
- [ ] Reserved Instance 구매 검토
- [ ] 아키텍처 최적화 기회 탐색
- [ ] 불필요한 스냅샷/백업 정리

## 🎯 목표

1. **첫 12개월**: 월 1,000원 이하
2. **13개월 이후**: 월 40,000원 이하
3. **트래픽 2배 증가 시**: 월 45,000원 이하

---

**작성일**: 2025년 9월
**검토 주기**: 매월
**다음 검토일**: 2025년 10월 1일