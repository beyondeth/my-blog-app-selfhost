# S3 폴더 구조 정리 계획

## 현재 상황
- **uploads/** 폴더: 실제 사용 중 (v1)
- **v2/** 폴더: 마이그레이션 준비 코드만 있고 실제 사용 안 함

## 결정 사항
uploads/ 폴더 구조를 계속 사용하고 v2 마이그레이션 코드는 제거

### 이유
1. uploads/ 구조가 이미 안정적으로 작동 중
2. v2 마이그레이션의 복잡성 대비 이점이 불명확
3. 현재 구조로도 충분한 조직화 달성
   - `uploads/{fileType}/{year}/{month}/{uuid}.ext`
   - fileType으로 구분 (image, document, video 등)
   - 연도/월로 시간별 정리
   - UUID로 충돌 방지

## 정리 작업
1. v2 관련 마이그레이션 코드 제거
   - contextual-file.service.ts
   - file-migration.service.ts
   - 관련 테스트 파일들

2. uploads/ 구조 유지 및 문서화
   - 현재 구조를 공식 표준으로 확정
   - 관련 문서 업데이트

3. 프론트엔드 수정
   - RichTextEditor가 백엔드 accessUrl 우선 사용
   - 백엔드 권한 존중 원칙 준수