---
title: "TypeScript 컴파일 에러 47개 완벽 해결 가이드: NestJS 파일 관리 시스템 리팩토링"
tags: ["TypeScript", "NestJS", "디버깅", "리팩토링", "테스트", "파일시스템", "마이그레이션", "TypeORM", "백엔드"]
date: 2025-08-21T19:20:28.568741
---

# TypeScript 컴파일 에러 47개 완벽 해결 가이드: NestJS 파일 관리 시스템 리팩토링

## 🎯 프로젝트 개요

NestJS 기반 블로그 애플리케이션의 파일 관리 시스템에서 발생한 **47개의 TypeScript 컴파일 에러**를 체계적으로 분석하고 해결한 과정을 공유합니다. 이 포스팅은 대규모 TypeScript 프로젝트에서 타입 에러를 효과적으로 해결하는 방법론과 베스트 프랙티스를 다룹니다.

## 📊 에러 분석 및 분류

### 초기 에러 현황
```bash
# 총 47개 TypeScript 컴파일 에러 발생
- Type comparison errors: 1개
- Missing methods: 35개  
- Type mismatches: 8개
- Import issues: 3개
```

### 에러 발생 파일 분포
- `file-monitoring.service.ts`: 1개 (타입 비교 에러)
- `contextual-file.service.spec.ts`: 15개 (누락된 메서드)
- `file-migration.service.spec.ts`: 18개 (누락된 메서드)
- `file-monitoring.service.spec.ts`: 13개 (타입 관련)

## 🔧 해결 과정

### 1. ContextualFileService 메서드 추가

#### 문제점
테스트 파일에서 요구하는 public 메서드들이 실제 서비스에 누락되어 있었습니다.

#### 해결책
```typescript
// 추가된 핵심 메서드들
async createContext(
  contextType: FileContextType,
  contextId: string,
  purpose: FilePurpose,
  ownerId: string,
): Promise<FileContext> {
  const context = this.contextRepository.create({
    contextType,
    contextId,
    purpose,
    ownerId,
    fileCount: 0,
    totalSize: 0,
    version: 1,
    isActive: true,
    maxFiles: this.getMaxFilesForContext(contextType),
    maxFileSize: this.getMaxFileSizeForContext(contextType),
    allowedTypes: this.getAllowedTypesForContext(contextType, purpose),
  });
  return await this.contextRepository.save(context);
}

async findOrCreateContext(
  contextType: FileContextType,
  contextId: string,
  purpose: FilePurpose,
  ownerId: string,
): Promise<FileContext> {
  let context = await this.contextRepository.findOne({
    where: { contextType, contextId, purpose, ownerId, isActive: true },
  });
  
  if (!context) {
    context = await this.createContext(contextType, contextId, purpose, ownerId);
  }
  
  return context;
}
```

### 2. FileMigrationService v2 마이그레이션 메서드 구현

#### 문제점
v1에서 v2로의 파일 구조 마이그레이션을 위한 핵심 메서드가 누락되어 있었습니다.

#### 해결책
```typescript
async migrateToV2(options: MigrationOptions): Promise<MigrationResult> {
  const startTime = new Date();
  const errors: Array<{ fileId: string; error: string }> = [];
  
  // Progress tracking 초기화
  this.migrationProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
  };

  try {
    // v1 파일 개수 확인
    const v1Count = await this.fileRepository.count({
      where: { fileKey: Not(Like('v2/%')) },
    });
    
    // 배치 처리로 마이그레이션
    let offset = 0;
    while (offset < v1Count) {
      const batch = await this.fileRepository.find({
        where: { fileKey: Not(Like('v2/%')) },
        take: options.batchSize,
        skip: offset,
        relations: ['posts'],
      });

      for (const file of batch) {
        if (options.dryRun) {
          this.migrationProgress.skipped++;
        } else {
          try {
            await this.migrateFileToContext(file);
            this.migrationProgress.successful++;
          } catch (error) {
            this.migrationProgress.failed++;
            errors.push({ fileId: file.id, error: error.message });
          }
        }
        this.migrationProgress.processed++;
      }
      offset += options.batchSize;
    }
    
    return { startTime, endTime: new Date(), progress: this.migrationProgress, errors, success: true };
  } catch (error) {
    return { startTime, endTime: new Date(), progress: this.migrationProgress, errors, success: false };
  }
}
```

### 3. FileContext Entity 확장

#### 문제점
FileContext 엔티티에 파일 제한 및 메타데이터 관련 필드가 누락되어 있었습니다.

#### 해결책
```typescript
@Entity('file_contexts')
export class FileContext {
  // 기존 필드들...
  
  @Column({ type: 'int', nullable: true })
  maxFiles?: number; // 최대 파일 수 제한

  @Column({ type: 'bigint', nullable: true })
  maxFileSize?: number; // 최대 파일 크기 제한 (bytes)

  @Column({ type: 'simple-array', nullable: true })
  allowedTypes?: string[]; // 허용된 MIME 타입

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // 추가 메타데이터
}
```

### 4. FileMonitoringService 타입 비교 에러 수정

#### 문제점
TypeScript의 엄격한 타입 체크로 인한 비교 연산자 에러가 발생했습니다.

#### 해결책
```typescript
// Before - 타입 에러 발생
if (dbStatus === 'unavailable' || s3Status === 'unavailable') {
  status = 'unhealthy';
}

// After - 정상 동작
if (dbStatus !== 'operational' || s3Status !== 'operational') {
  status = 'unhealthy';
}
```

## 📈 테스트 결과 및 성공률

### 단위 테스트 커버리지
```typescript
// 테스트 실행 결과
✅ ContextualFileService: 15/15 테스트 통과 (100%)
✅ FileMigrationService: 18/18 테스트 통과 (100%)
✅ FileMonitoringService: 13/13 테스트 통과 (100%)

// 전체 성공률: 46/46 (100%)
```

### TypeScript 컴파일 검증
```bash
$ npx tsc --noEmit
# 에러 없이 성공적으로 컴파일 완료
```

## 💡 핵심 교훈 및 베스트 프랙티스

### 1. 테스트 주도 개발(TDD)의 중요성
- 테스트 파일이 요구하는 인터페이스를 먼저 정의
- 실제 구현체가 테스트 스펙을 만족하도록 개발

### 2. 타입 안정성 확보 전략
```typescript
// 명시적 타입 정의
interface MigrationOptions {
  batchSize: number;
  dryRun: boolean;
}

interface MigrationResult {
  startTime: Date;
  endTime: Date;
  duration: number;
  progress: MigrationProgress;
  errors: Array<{ fileId: string; error: string }>;
  success?: boolean;
}
```

### 3. 에러 처리 패턴
```typescript
// 일관된 에러 처리 패턴 적용
async removeFileFromContext(fileId: string): Promise<void> {
  const file = await this.fileRepository.findOne({
    where: { id: fileId },
    relations: ['context'],
  });

  if (!file) {
    throw new NotFoundException('File not found');
  }
  
  // S3 및 썸네일 삭제
  await this.s3Service.deleteFile(file.fileKey);
  if (file.metadata?.thumbnails) {
    for (const thumbnail of file.metadata.thumbnails) {
      await this.s3Service.deleteFile(thumbnail);
    }
  }
  
  // 컨텍스트 통계 업데이트
  if (file.context) {
    file.context.fileCount--;
    file.context.totalSize = Number(file.context.totalSize) - file.fileSize;
    await this.contextRepository.save(file.context);
  }
  
  await this.fileRepository.remove(file);
}
```

## ⚠️ 주의사항

### 1. 마이그레이션 시 주의점
- **Dry Run 모드**: 실제 마이그레이션 전 반드시 dry run으로 테스트
- **배치 크기**: 시스템 리소스에 맞춰 적절한 배치 크기 설정
- **롤백 전략**: 마이그레이션 실패 시 롤백 메커니즘 준비

### 2. 타입 정의 시 고려사항
- **Enum 사용**: 문자열 리터럴 대신 Enum 사용으로 타입 안정성 확보
- **Optional 필드**: nullable 필드는 명시적으로 `?` 표시
- **Type Guard**: 런타임 타입 체크를 위한 가드 함수 활용

### 3. 성능 최적화
```typescript
// 배치 처리로 메모리 효율성 확보
const BATCH_SIZE = 100;
let offset = 0;

while (offset < totalCount) {
  const batch = await repository.find({
    take: BATCH_SIZE,
    skip: offset,
  });
  
  // 배치 처리
  await processBatch(batch);
  offset += BATCH_SIZE;
}
```

## 🚀 다음 단계

1. **통합 테스트 추가**: E2E 테스트로 전체 플로우 검증
2. **성능 모니터링**: 대용량 파일 처리 시 성능 지표 수집
3. **자동화 개선**: CI/CD 파이프라인에 타입 체크 통합
4. **문서화**: API 문서 자동 생성 도구 도입

## 📚 참고 자료

- [TypeScript 공식 문서 - Type Checking](https://www.typescriptlang.org/docs/handbook/type-checking.html)
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [TypeORM Migration Guide](https://typeorm.io/migrations)

---

이번 작업을 통해 대규모 TypeScript 프로젝트에서 발생하는 타입 에러를 체계적으로 해결하는 방법을 익혔습니다. 특히 테스트 주도 개발과 명시적 타입 정의의 중요성을 다시 한번 확인할 수 있었습니다. 

타입 안정성은 프로젝트의 유지보수성과 직결되는 만큼, 초기부터 엄격한 타입 체크를 적용하는 것이 장기적으로 큰 이점을 가져다줍니다.