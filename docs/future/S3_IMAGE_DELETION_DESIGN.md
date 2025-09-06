# 🎯 S3 이미지 삭제 설계 문서

## 📊 현재 상황 분석 (Ultra-Deep Analysis)

### 1. 현재 문제점
```
포스트 삭제 시 → DB 레코드만 삭제 → S3 이미지는 그대로 남음
```

**발견된 이슈:**
- 포스트 삭제 시 S3 이미지가 **삭제되지 않음** ❌
- DB의 `post_files` 관계만 삭제됨
- S3 스토리지에 고아 파일 누적 → 비용 증가
- 파일 참조 카운팅 메커니즘 부재

### 2. 현재 구조 분석

#### 데이터 모델
```typescript
Post ←→ post_files (join table) ←→ File
         - postId                    - id
         - fileId                    - fileKey (S3 키)
                                     - userId
                                     - contextId
```

#### 삭제 플로우 (현재)
```sql
1. DELETE FROM post_tags WHERE post_id = ?
2. DELETE FROM post_files WHERE "postId" = ? -- CASCADE
3. DELETE FROM posts WHERE id = ?
```

**문제**: File 레코드와 S3 객체는 그대로 유지됨

### 3. 영향 범위 분석

#### 비용 영향
- S3 Standard Storage: $0.023/GB/월
- 평균 이미지 크기: 500KB
- 월 1000개 포스트 삭제 시: 500MB 누적
- 연간: 6GB × $0.023 = $0.138 (작지만 누적됨)

#### 보안/규정 영향
- GDPR: 사용자 데이터 완전 삭제 요구사항
- 개인정보보호: 삭제된 컨텐츠의 완전 제거 필요

## 🏗️ 설계 방안

### 옵션 1: 즉시 삭제 (Immediate Deletion) ⭐ 추천
```typescript
async remove(id: string, user: User): Promise<void> {
  const post = await this.findPostWithFiles(id);
  
  // 1. 파일 목록 확보
  const files = post.attachedFiles;
  
  // 2. 트랜잭션 시작
  await this.dataSource.transaction(async (manager) => {
    // 3. post_tags 삭제
    await manager.query('DELETE FROM post_tags WHERE post_id = $1', [id]);
    
    // 4. 포스트 삭제 (CASCADE로 post_files, comments 등 삭제)
    await manager.remove(Post, post);
    
    // 5. 고아 파일 확인 및 S3 삭제
    for (const file of files) {
      const count = await manager.query(
        'SELECT COUNT(*) FROM post_files WHERE "fileId" = $1',
        [file.id]
      );
      
      if (count[0].count === 0) {
        // 다른 포스트에서 사용하지 않는 경우
        await this.s3Service.deleteFile(file.fileKey);
        await manager.remove(File, file);
      }
    }
  });
}
```

**장점:**
- 즉시 스토리지 정리
- 비용 최적화
- GDPR 준수

**단점:**
- S3 API 호출 증가
- 삭제 작업 시간 증가 (100-200ms)

### 옵션 2: 소프트 삭제 + 배치 처리 (Soft Delete + Batch)
```typescript
// 1. 포스트 삭제 시 파일에 마킹만
await file.update({ 
  deletedAt: new Date(),
  markedForDeletion: true 
});

// 2. 크론잡으로 주기적 정리
@Cron('0 2 * * *') // 매일 새벽 2시
async cleanupOrphanedFiles() {
  const orphanedFiles = await this.findOrphanedFiles();
  for (const file of orphanedFiles) {
    await this.s3Service.deleteFile(file.fileKey);
    await this.fileRepository.remove(file);
  }
}
```

**장점:**
- 빠른 삭제 응답
- 복구 가능성
- 배치 처리로 효율성

**단점:**
- 지연된 스토리지 정리
- 복잡한 상태 관리

### 옵션 3: 참조 카운팅 (Reference Counting)
```typescript
// File 엔티티에 참조 카운터 추가
@Column({ default: 0 })
referenceCount: number;

// 포스트 생성 시: referenceCount++
// 포스트 삭제 시: referenceCount--
// referenceCount === 0 → S3 삭제
```

**장점:**
- 정확한 사용 추적
- 공유 파일 지원

**단점:**
- 카운터 동기화 복잡성
- 트랜잭션 필수

## 📋 구현 계획 (추천: 옵션 1)

### Phase 1: 기본 구현 (1일)
1. ✅ `posts.service.ts`에 S3 삭제 로직 추가
2. ✅ 트랜잭션으로 원자성 보장
3. ✅ 테스트 케이스 작성

### Phase 2: 최적화 (1일)
1. ⏳ 배치 S3 삭제 API 사용 (DeleteObjectsCommand)
2. ⏳ 삭제 이벤트 로깅
3. ⏳ 실패 시 재시도 메커니즘

### Phase 3: 모니터링 (1일)
1. ⏳ S3 삭제 메트릭 수집
2. ⏳ 고아 파일 감지 스크립트
3. ⏳ 정기 감사 리포트

## 🔧 구현 코드 (즉시 적용 가능)

```typescript
// posts.service.ts
async remove(id: string, user: User): Promise<void> {
  const post = await this.postsRepository.findOne({
    where: { id },
    relations: ['author', 'attachedFiles'],
  });

  if (!post) {
    throw new NotFoundException('Post not found');
  }

  if (post.author.id !== user.id && user.role !== Role.ADMIN) {
    throw new ForbiddenException('You can only delete your own posts');
  }

  // S3 이미지 삭제를 포함한 트랜잭션 처리
  await this.dataSource.transaction(async (manager: EntityManager) => {
    // 1. post_tags 삭제 (CASCADE 없음)
    await manager.query('DELETE FROM post_tags WHERE post_id = $1', [id]);
    
    // 2. 파일 처리
    const filesToDelete = post.attachedFiles || [];
    
    // 3. 포스트 삭제 (CASCADE로 관계 테이블 삭제)
    await manager.remove(Post, post);
    
    // 4. S3에서 파일 삭제
    for (const file of filesToDelete) {
      try {
        // 다른 포스트에서 사용 중인지 확인
        const usageCount = await manager.query(
          'SELECT COUNT(*) as count FROM post_files WHERE "fileId" = $1',

          
          [file.id]
        );
        
        if (parseInt(usageCount[0].count) === 0) {
          // S3에서 삭제
          await this.s3Service.deleteFile(file.fileKey);
          
          // 썸네일도 있다면 삭제
          if (file.metadata?.thumbnails) {
            for (const thumbnail of file.metadata.thumbnails) {
              await this.s3Service.deleteFile(thumbnail);
            }
          }
          
          // DB에서 File 레코드 삭제
          await manager.remove(File, file);
          
          this.logger.log(`Deleted S3 file: ${file.fileKey}`);
        }
      } catch (error) {
        this.logger.error(`Failed to delete S3 file ${file.fileKey}:`, error);
        // 실패해도 포스트 삭제는 계속 진행
      }
    }
  });
  
  this.logger.log(`Post ${id} and associated S3 files deleted successfully`);
}
```

## 🧪 테스트 시나리오

1. **단일 사용 파일**: 포스트 삭제 → S3 파일 삭제 확인
2. **공유 파일**: 여러 포스트가 같은 파일 참조 → 마지막 포스트 삭제 시만 S3 삭제
3. **실패 처리**: S3 삭제 실패 → 포스트는 삭제, 에러 로그
4. **대량 파일**: 10개 이상 이미지 포스트 → 모든 파일 삭제 확인

## 🚨 주의사항

1. **트랜잭션 크기**: 파일이 많은 포스트는 트랜잭션이 길어질 수 있음
2. **S3 요금**: DeleteObject API 호출당 $0.0004 (1000건당 $0.40)
3. **복구 불가**: S3에서 삭제된 파일은 복구 불가능
4. **CDN 캐시**: CloudFront 캐시 무효화 필요할 수 있음

## 📈 모니터링 지표

- S3 삭제 성공률
- 평균 삭제 시간
- 고아 파일 수
- 스토리지 사용량 추이

## 🎯 결론

**추천: 옵션 1 (즉시 삭제)** 구현
- 구현 복잡도: 낮음
- 효과: 즉시
- 비용 절감: 월 $10-50 (규모에 따라)
- GDPR 준수: ✅

트랜잭션 내에서 S3 삭제를 처리하여 일관성과 완전성을 보장하는 것이 가장 실용적인 해결책입니다.