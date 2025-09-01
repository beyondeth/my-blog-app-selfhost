---
title: "TypeORM 마이그레이션과 AWS RDS 연동 완벽 가이드"
tags: ["TypeORM", "AWS RDS", "PostgreSQL", "마이그레이션", "백엔드", "데이터베이스", "NestJS"]
date: 2025-09-01T17:08:32.072989
---

# TypeORM 마이그레이션과 AWS RDS 연동 완벽 가이드

오늘은 TypeORM을 사용한 데이터베이스 마이그레이션 작업과 AWS RDS 연동 과정을 정리해보겠습니다. 실제 프로젝트에서 사용자 프로필의 bio 필드를 500자에서 1000자로 확장하는 작업을 진행하면서 겪은 경험을 공유합니다.

## 📌 문제 상황

프론트엔드에서 사용자 프로필 소개(bio) 필드를 1000자까지 입력할 수 있도록 수정했는데, 백엔드에서 다음과 같은 에러가 발생했습니다:

```
Bio must not exceed 500 characters
```

## 🔍 원인 분석

백엔드 코드를 확인해보니 두 곳에서 제한이 걸려있었습니다:

1. **DTO (Data Transfer Object)**: `@MaxLength(500)` 
2. **Entity**: `@Column({ nullable: true, length: 500 })`

## 🛠️ 해결 과정

### 1단계: 백엔드 코드 수정

**DTO 파일 수정** (`update-profile.dto.ts`):
```typescript
@ApiPropertyOptional({
  description: 'User bio',
  maxLength: 1000,  // 500 → 1000
  example: 'A passionate developer who loves coding',
})
@IsOptional()
@IsString()
@MaxLength(1000, { message: 'Bio must not exceed 1000 characters' })
bio?: string;
```

**Entity 파일 수정** (`user.entity.ts`):
```typescript
@Column({ nullable: true, length: 1000 })  // 500 → 1000
bio: string;
```

### 2단계: 마이그레이션 생성 및 실행

```bash
# 마이그레이션 파일 자동 생성
cd backend
npx typeorm-ts-node-commonjs migration:generate src/migrations/UpdateBioLength -d src/data-source.ts

# 마이그레이션 실행 (DB에 실제 적용)
npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts
```

### 3단계: 프론트엔드 수정

```tsx
<textarea
  id="bio"
  value={formData.bio}
  onChange={(e) => {
    if (e.target.value.length <= 1000) {
      setFormData({ ...formData, bio: e.target.value });
    }
  }}
  rows={4}
  maxLength={1000}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
  placeholder="자신을 소개해주세요..."
/>
<div className="mt-1 flex justify-between text-xs text-gray-500">
  <span>자신을 소개하는 글을 작성해주세요</span>
  <span>{formData.bio.length}/1000</span>
</div>
```

## 🎯 TypeORM 마이그레이션 이해하기

### data-source.ts란?

TypeORM이 데이터베이스와 연결하기 위한 설정 파일입니다. 이 파일은:
- DB 접속 정보 (호스트, 포트, 사용자명, 비밀번호)
- Entity 파일 위치
- 마이그레이션 파일 위치
등을 정의합니다.

### 마이그레이션이 필요한 이유

1. **버전 관리**: 모든 DB 스키마 변경 이력이 코드로 남음
2. **팀 협업**: 다른 개발자도 같은 DB 구조를 쉽게 구성 가능
3. **롤백 가능**: 문제 발생 시 이전 버전으로 되돌릴 수 있음
4. **자동화**: Entity 변경사항을 자동으로 SQL로 변환

## 🌐 AWS RDS 연동

### 현재 프로젝트 구조

```
.env 파일:
DB_URL=postgresql://postgres:postgres@myblog.cqbcg2aqsrdx.us-east-1.rds.amazonaws.com:5432/blog-db
```

### 작동 방식

1. `data-source.ts`가 `.env` 파일의 `DB_URL`을 읽음
2. AWS RDS 엔드포인트로 연결 (SSL 포함)
3. 마이그레이션 명령 실행 시 AWS RDS에 직접 적용
4. 로컬에서 명령을 실행해도 실제 변경은 클라우드 DB에 반영

### SSL 설정

```typescript
// AWS RDS는 SSL 연결 필요
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

return {
  ...baseConfig,
  url: dbUrl,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
};
```

## 💡 실용적인 팁

### package.json 스크립트 추가

마이그레이션 명령어가 길어서 불편하다면, package.json에 스크립트를 추가하세요:

```json
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts",
    "migration:show": "typeorm-ts-node-commonjs migration:show -d src/data-source.ts"
  }
}
```

이후 간단하게 사용:
```bash
pnpm migration:generate src/migrations/UpdateBioLength
pnpm migration:run
```

### 자주 사용하는 명령어

```bash
# 실행된 마이그레이션 확인
pnpm migration:show

# 마지막 마이그레이션 취소
pnpm migration:revert

# 마이그레이션 생성 (변경사항 자동 감지)
pnpm migration:generate src/migrations/변경내용설명
```

## ⚠️ 주의사항

1. **Entity 수정 → 마이그레이션 생성 → 실행** 순서를 꼭 지키세요
2. 프로덕션 DB에 적용하기 전에 개발 환경에서 테스트하세요
3. `.env` 파일은 절대 Git에 커밋하지 마세요 (보안 정보 포함)
4. 마이그레이션 파일은 수정하지 말고 새로 생성하세요

## 🎉 결과

이제 사용자는 프로필 소개를 최대 1000자까지 작성할 수 있으며, 실시간으로 글자 수를 확인할 수 있습니다. TypeORM 마이그레이션을 통해 데이터베이스 스키마 변경이 체계적으로 관리되고, AWS RDS와의 연동도 원활하게 작동합니다.

## 마무리

TypeORM과 AWS RDS를 함께 사용하면 처음엔 복잡해 보이지만, 한 번 설정해두면 데이터베이스 관리가 매우 편해집니다. 특히 마이그레이션 시스템은 팀 협업과 버전 관리에 큰 도움이 됩니다.

---

#TypeORM #AWS #RDS #PostgreSQL #마이그레이션 #백엔드 #데이터베이스