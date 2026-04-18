export const sampleAutoPostingMarkdown = `# MCP 자동포스팅 문서형 렌더 샘플

> 자동포스팅으로 만들어진 글은 정보 밀도가 높습니다. 그래서 본문이 단순히 길게 이어지는 것보다, 문서처럼 계층과 리듬이 보이도록 렌더링하는 편이 발행 품질을 더 잘 전달합니다.

## 왜 이 샘플이 필요한가

자동포스팅 결과물은 대체로 제목, 요약, 단계, 비교표, 체크리스트, 코드 예시가 함께 들어갑니다. 지금처럼 일반 HTML 본문 렌더링만으로도 읽을 수는 있지만, 문서형 레이아웃을 주면 다음 장점이 생깁니다.

- 섹션 구조가 선명해져 훑어보기 속도가 빨라집니다.
- 표와 체크리스트가 덜 무너지고, 모바일에서도 정보 밀도가 유지됩니다.
- diagram block을 본문 일부가 아니라 문서의 핵심 블록처럼 다룰 수 있습니다.

### 기대 효과

- 자동포스팅된 기술 글, 리서치 글, 운영 문서를 같은 패턴으로 읽을 수 있습니다.
- 글 자체가 더 "완성된 산출물"처럼 보여서 공유와 재방문율에 유리합니다.
- 향후 implementation plan, task, walkthrough 같은 AI 문서에도 같은 뷰어를 재사용할 수 있습니다.

## 자동포스팅 파이프라인

\`\`\`diagram
type: flow
style: clean
direction: horizontal
title: 자동포스팅 파이프라인
nodes:
  - id: draft
    label: 대화 또는 초안
    note: 사용자의 자연어 요청
    kind: focus
  - id: create
    label: MCP create_post 호출
    note: content_markdown 포함
  - id: render
    label: backend markdown -> html 변환
    note: language-diagram 블록 보존
  - id: publish
    label: 게시 화면 렌더
    note: 문서형 viewer와 차트 표시
    kind: output
edges:
  - from: draft
    to: create
    label: 초안 생성
  - from: create
    to: render
    label: 저장 후 처리
  - from: render
    to: publish
    label: 최종 게시
\`\`\`

## 발행 규칙 요약

| 요소 | 렌더 규칙 | 차용 포인트 |
| --- | --- | --- |
| 제목 계층 | H1/H2/H3 간 간격을 넓게 유지 | implementation plan 느낌의 문서 리듬 확보 |
| 요약/메모 | blockquote를 callout 카드처럼 표시 | 본문 시작부의 핵심 메시지를 빠르게 전달 |
| 체크리스트 | 체크박스와 텍스트 간 간격 보정 | 실행 항목이 많은 글에서도 스캔 가능 |
| 표 | sticky 느낌의 카드 내부에서 overflow 처리 | 모바일에서도 깨지지 않는 비교표 유지 |
| 코드 | 복사 버튼이 있는 코드 카드 재사용 | 자동포스팅 예시 payload 제시에 적합 |
| 워크플로우 | diagram block을 본문 카드처럼 렌더링 | 문서 안에서 다이어그램 비중 강화 |

## 추천 문서 템플릿

**권장 흐름**

1. 한 문단으로 문제를 요약합니다.
2. 독자가 바로 훑어볼 수 있는 비교표를 둡니다.
3. 실행 절차나 워크플로우는 diagram block으로 시각화합니다.
4. 마지막에는 체크리스트와 코드 예시를 둡니다.

> 핵심 메모: 자동포스팅 결과물은 "글"이면서 동시에 "작업 산출물"입니다. 문서형 렌더러는 이 두 성격을 함께 살리는 데 유리합니다.

- [x] 섹션별 heading 체계 유지
- [x] 표/코드/차트가 섞여도 읽기 흐름 보존
- [x] 원본 Markdown을 그대로 저장
- [ ] production 상세 페이지에 조건부 적용 검토

\`\`\`json
{
  "title": "MCP 자동포스팅 문서형 샘플",
  "category": "development",
  "tags": ["mcp", "autoposting", "markdown"],
  "content_markdown": "# 문서 제목\\n\\n## 요약\\n- 핵심 포인트\\n- 실행 포인트",
  "visibility": "public"
}
\`\`\`

## 실제 도입 가이드

1. 자동포스팅으로 생성된 post가 \`content_type = markdown\` 인지 먼저 구분합니다.
2. \`content_markdown\` 이 있는 글에만 문서형 viewer를 우선 적용합니다.
3. 기존 HTML 포스트와 마켓플레이스 본문은 기존 렌더러를 유지합니다.
4. 채용 여부는 /sample에서 독서성, 정보 구조, 모바일 안정성을 보고 판단합니다.

관련 참고 링크: [Codebase.blog 문서 운영 메모](https://codebase.blog)
`;
