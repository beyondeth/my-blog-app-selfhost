export type SceneAccent = "teal" | "navy" | "mint" | "sand" | "rose";

export type SceneNodeVariant = "banner" | "summary" | "hero" | "panel" | "strip";

export type SceneAnchor = "top" | "right" | "bottom" | "left";

export type SceneSurface =
  | "document"
  | "whiteboard"
  | "sketch"
  | "editor"
  | "workflow"
  | "network"
  | "studio";

export interface SceneEvidence {
  title: string;
  meta: string;
}

export interface SceneRow {
  label: string;
  value: string;
}

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  variant: SceneNodeVariant;
  accent: SceneAccent;
  eyebrow?: string;
  title: string;
  summary?: string;
  bullets?: string[];
  rows?: SceneRow[];
  evidence?: SceneEvidence[];
}

export interface SceneConnector {
  id: string;
  from: string;
  to: string;
  fromAnchor?: SceneAnchor;
  toAnchor?: SceneAnchor;
  tone: "primary" | "secondary" | "dashed";
  label?: string;
}

export interface SceneDefinition {
  id: string;
  index: number;
  name: string;
  blurb: string;
  category: string;
  surface: SceneSurface;
  width: number;
  height: number;
  inspiration: {
    name: string;
    repo: string;
    url: string;
    note: string;
  };
  nodes: SceneNode[];
  connectors: SceneConnector[];
  sourceExcerpt: string;
}

export const canvasScenes: SceneDefinition[] = [
  {
    id: "enterprise-learning-loop",
    index: 1,
    name: "Enterprise Learning Loop",
    category: "문서형 구조도",
    surface: "document",
    blurb:
      "상단 선언부, 중앙 순환 구조, 하단 운영 블록을 한 장의 구조도로 정리한 문서형 보드입니다.",
    width: 1500,
    height: 1220,
    inspiration: {
      name: "draw.io",
      repo: "jgraph/drawio",
      url: "https://github.com/jgraph/drawio",
      note: "기업 문서형 구조도, 표 중심 박스 배치, 안정적인 상하 흐름",
    },
    sourceExcerpt: `{
  "scene": "enterprise-learning-loop",
  "nodes": [
    { "id": "banner", "variant": "banner", "title": "기업용 인재 영입 및 교육 서비스" },
    { "id": "vision", "variant": "summary", "title": "비전" },
    { "id": "core-loop", "variant": "hero", "title": "핵심 구조 - 순환 흐름" },
    { "id": "stage-panel", "variant": "panel", "title": "지원 과정 (Stage)" }
  ],
  "connectors": [
    { "from": "stage-panel", "to": "core-loop", "tone": "primary" },
    { "from": "core-loop", "to": "ops", "tone": "secondary" }
  ]
}`,
    nodes: [
      {
        id: "banner",
        x: 40,
        y: 36,
        w: 1420,
        h: 92,
        variant: "banner",
        accent: "navy",
        eyebrow: "Canvas JSON Sample",
        title: "기업용 인재 영입 및 교육 서비스",
        summary:
          "상단 선언부, 중앙 순환 흐름, 주변 세부 패널, 하단 운영 레일을 한 캔버스에서 제어하는 문서형 구조도",
      },
      {
        id: "vision",
        x: 40,
        y: 160,
        w: 452,
        h: 204,
        variant: "summary",
        accent: "teal",
        title: "비전",
        bullets: [
          "글로벌 인재 육성 파트너",
          "고객사 교육 운영 체계 강화",
          "채용부터 온보딩까지 구조화",
        ],
      },
      {
        id: "mission",
        x: 524,
        y: 160,
        w: 452,
        h: 204,
        variant: "summary",
        accent: "mint",
        title: "미션",
        bullets: [
          "교육과 채용 데이터를 하나의 흐름으로 연결",
          "콘텐츠 품질과 운영 생산성을 동시에 높임",
          "고객사 경쟁력과 내부 실행력을 함께 강화",
        ],
      },
      {
        id: "values",
        x: 1008,
        y: 160,
        w: 452,
        h: 204,
        variant: "summary",
        accent: "sand",
        title: "핵심 가치 / 인재상",
        bullets: [
          "문제 정의부터 실행까지 연결하는 사람",
          "데이터로 학습하고 빠르게 개선하는 팀",
          "콘텐츠와 서비스 품질을 함께 보는 시각",
        ],
      },
      {
        id: "core-loop",
        x: 370,
        y: 420,
        w: 760,
        h: 230,
        variant: "hero",
        accent: "navy",
        eyebrow: "핵심 구조",
        title: "순환 흐름",
        rows: [
          { label: "지원 과정", value: "지원자 유입과 채용 단계 설계" },
          { label: "콘텐츠 기획", value: "직무/역량별 학습 시나리오 구성" },
          { label: "데이터 수집", value: "학습/평가/채용 데이터 통합" },
          { label: "서비스 개발", value: "도구, 운영 화면, 리포트 자동화" },
        ],
      },
      {
        id: "stage-panel",
        x: 40,
        y: 716,
        w: 452,
        h: 316,
        variant: "panel",
        accent: "teal",
        eyebrow: "좌상",
        title: "지원 과정 (Stage)",
        rows: [
          { label: "서류 전형", value: "지원자 DB 구축, 기본 자격 검토" },
          { label: "면접 전형", value: "과제, 테스트, 역량/인성 평가" },
          { label: "최종 합격", value: "오리엔테이션, 교육 배정, 온보딩" },
        ],
        evidence: [
          { title: "지원 단계별 FAQ 문서", meta: "운영 매뉴얼 · 8분" },
          { title: "면접 운영 체크리스트", meta: "실무 노트 · 5분" },
        ],
      },
      {
        id: "service-panel",
        x: 524,
        y: 716,
        w: 452,
        h: 316,
        variant: "panel",
        accent: "navy",
        eyebrow: "좌하",
        title: "서비스 개발 프로세스",
        rows: [
          { label: "요구 사항 정의", value: "인터뷰, 시장 조사, 문제 정의서" },
          { label: "시스템 설계", value: "아키텍처, UI/UX, 와이어프레임" },
          { label: "프로토타입", value: "핵심 기능 검증, 초기 테스트" },
          { label: "배포", value: "통합 테스트, 운영 가이드, 런칭" },
        ],
        evidence: [
          { title: "서비스 요구 사항 정리", meta: "PM 노트 · 11분" },
          { title: "운영 자동화 설계 초안", meta: "아키텍처 메모 · 7분" },
        ],
      },
      {
        id: "data-panel",
        x: 1008,
        y: 716,
        w: 452,
        h: 316,
        variant: "panel",
        accent: "mint",
        eyebrow: "우하",
        title: "데이터 수집 및 통합",
        rows: [
          { label: "프로필", value: "경력, 기술, 선호 영역" },
          { label: "학습 이력", value: "진도, 수료, 학습 패턴" },
          { label: "평가 결과", value: "퀴즈, 시험, 과제 성과" },
          { label: "채용 데이터", value: "지원자 정보, 면접 결과, 입사 여부" },
        ],
        evidence: [
          { title: "데이터 수집 정책 정리", meta: "정책 분석 · 9분" },
          { title: "학습 로그 설계 기준", meta: "개발 메모 · 6분" },
        ],
      },
      {
        id: "ops",
        x: 40,
        y: 1084,
        w: 1420,
        h: 88,
        variant: "strip",
        accent: "sand",
        title: "서비스 운영 및 관리",
        summary:
          "서비스 품질 유지, 사용자 지원, 교육 효과 분석, 플랫폼 안정성 및 보안 관리",
      },
    ],
    connectors: [
      { id: "banner-core", from: "banner", to: "core-loop", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "vision-core", from: "vision", to: "core-loop", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "mission-core", from: "mission", to: "core-loop", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "values-core", from: "values", to: "core-loop", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "stage-loop", from: "stage-panel", to: "core-loop", fromAnchor: "top", toAnchor: "left", tone: "primary", label: "입력" },
      { id: "service-loop", from: "service-panel", to: "core-loop", fromAnchor: "top", toAnchor: "bottom", tone: "primary", label: "개선" },
      { id: "data-loop", from: "data-panel", to: "core-loop", fromAnchor: "top", toAnchor: "right", tone: "primary", label: "측정" },
      { id: "loop-ops", from: "core-loop", to: "ops", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
    ],
  },
  {
    id: "kb-branch-board",
    index: 2,
    name: "Knowledge Branch Board",
    category: "분기형 위키 보드",
    surface: "studio",
    blurb:
      "중심 주제에서 오른쪽과 아래 대각선으로 분기되며, 패널별 근거 포스트를 붙여 신뢰감을 주는 구조입니다.",
    width: 1500,
    height: 1080,
    inspiration: {
      name: "maxGraph",
      repo: "maxGraph/maxGraph",
      url: "https://github.com/maxGraph/maxGraph",
      note: "직교형 분기 구조와 정리된 박스 배치를 지식 보드 문법으로 번역한 예시",
    },
    sourceExcerpt: `{
  "scene": "kb-branch-board",
  "focus": "윤리 기준",
  "panels": [
    { "title": "이 주제가 놓인 흐름", "layoutHint": "right" },
    { "title": "더 구체적인 주제", "layoutHint": "bottomLeft" },
    { "title": "이어서 보기 좋은 주제", "layoutHint": "bottomRight" }
  ],
  "evidencePostsPerPanel": 2
}`,
    nodes: [
      {
        id: "root",
        x: 60,
        y: 140,
        w: 300,
        h: 152,
        variant: "summary",
        accent: "sand",
        eyebrow: "상위 흐름",
        title: "정책 / 거버넌스",
        summary: "현재 주제가 속한 더 큰 분류와 읽기 맥락",
      },
      {
        id: "focus",
        x: 460,
        y: 220,
        w: 420,
        h: 220,
        variant: "hero",
        accent: "navy",
        eyebrow: "지금 보는 주제",
        title: "윤리 기준",
        summary:
          "모델/서비스 운영에서 무엇을 허용하고 무엇을 금지할지, 그리고 그 기준을 어떻게 실제 시스템 규칙으로 내릴지 정리한 중심 주제",
        evidence: [
          { title: "정책 분석: 공개 규칙과 운영 룰", meta: "대표 글 · 13분" },
          { title: "관측 실험: 가이드라인 적용 결과", meta: "실험 노트 · 8분" },
        ],
      },
      {
        id: "primary",
        x: 460,
        y: 494,
        w: 420,
        h: 228,
        variant: "panel",
        accent: "teal",
        eyebrow: "핵심 구조",
        title: "이 주제가 놓인 흐름",
        rows: [
          { label: "기준 정의", value: "원칙을 규칙으로 내리는 단계" },
          { label: "측정 지표", value: "위반, 경계 사례, 운영 비용 추적" },
          { label: "실행 레이어", value: "정책 문서, 코드 가드, 운영 체크" },
          { label: "리뷰 주기", value: "정책과 현실 데이터의 차이 보정" },
        ],
        evidence: [
          { title: "정책 문서 구조 정리", meta: "기획 문서 · 10분" },
          { title: "운영 체크리스트 초안", meta: "실행 메모 · 7분" },
        ],
      },
      {
        id: "path-panel",
        x: 980,
        y: 176,
        w: 420,
        h: 250,
        variant: "panel",
        accent: "mint",
        eyebrow: "우측 분기",
        title: "이어서 보기 좋은 주제",
        rows: [
          { label: "콘텐츠 정책", value: "공개 범위와 표현 원칙" },
          { label: "운영 자동화", value: "정책을 코드와 큐에 연결" },
          { label: "리스크 레포트", value: "정책 적용 결과를 요약" },
        ],
        evidence: [
          { title: "운영 자동화와 정책 연결", meta: "개발 글 · 12분" },
          { title: "정책 리포트 설계", meta: "리서치 글 · 9분" },
        ],
      },
      {
        id: "detail-panel",
        x: 150,
        y: 784,
        w: 470,
        h: 246,
        variant: "panel",
        accent: "sand",
        eyebrow: "좌하 분기",
        title: "더 구체적인 주제",
        rows: [
          { label: "금지 규칙", value: "즉시 차단해야 하는 사례" },
          { label: "경계 사례", value: "사람 검토가 필요한 회색 지대" },
          { label: "공개 기준", value: "사용자에게 어떻게 설명할지" },
        ],
        evidence: [
          { title: "경계 사례 로그 분석", meta: "운영 노트 · 6분" },
          { title: "공개 문구 정리", meta: "카피 문서 · 4분" },
        ],
      },
      {
        id: "adjacent-panel",
        x: 760,
        y: 800,
        w: 470,
        h: 230,
        variant: "panel",
        accent: "rose",
        eyebrow: "우하 분기",
        title: "같이 보기 좋은 주제",
        rows: [
          { label: "신뢰도 표시", value: "사용자에게 결과를 어떻게 드러낼지" },
          { label: "검수 흐름", value: "작성자와 운영자의 확인 루프" },
        ],
        evidence: [
          { title: "검수 워크플로우 메모", meta: "프로세스 · 5분" },
          { title: "UI 노출 규칙 정리", meta: "디자인 문서 · 6분" },
        ],
      },
    ],
    connectors: [
      { id: "root-focus", from: "root", to: "focus", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "focus-primary", from: "focus", to: "primary", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "focus-path", from: "focus", to: "path-panel", fromAnchor: "right", toAnchor: "left", tone: "primary", label: "이어서 보기" },
      { id: "primary-detail", from: "primary", to: "detail-panel", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "primary-adjacent", from: "primary", to: "adjacent-panel", fromAnchor: "bottom", toAnchor: "top", tone: "dashed", label: "같이 보기" },
    ],
  },
  {
    id: "mcp-publishing-pipeline",
    index: 3,
    name: "MCP Posting Pipeline",
    category: "자동포스팅 흐름",
    surface: "editor",
    blurb:
      "LLM이 본문을 만들고, MCP가 포스트를 저장한 뒤, artifact와 candidate graph를 거쳐 public graph로 이어지는 구조를 좌우 흐름으로 보여줍니다.",
    width: 1580,
    height: 980,
    inspiration: {
      name: "React Flow",
      repo: "xyflow/xyflow",
      url: "https://github.com/xyflow/xyflow",
      note: "노드 편집기 스타일의 좌우 파이프라인과 단계형 연결 표현",
    },
    sourceExcerpt: `{
  "scene": "mcp-publishing-pipeline",
  "stages": [
    "LLM draft",
    "MCP create_post",
    "source artifact",
    "candidate graph",
    "approved graph"
  ],
  "renderTarget": "public tree + map"
}`,
    nodes: [
      {
        id: "draft",
        x: 50,
        y: 280,
        w: 270,
        h: 188,
        variant: "panel",
        accent: "sand",
        eyebrow: "입력",
        title: "LLM Draft",
        bullets: [
          "제목, 본문, 태그, 카테고리 생성",
          "차트는 fenced block으로 포함",
          "자동포스팅 프롬프트 기준 적용",
        ],
      },
      {
        id: "mcp",
        x: 380,
        y: 250,
        w: 300,
        h: 240,
        variant: "hero",
        accent: "navy",
        eyebrow: "저장",
        title: "MCP create_post",
        summary:
          "로컬 또는 프로덕션 MCP route를 통해 포스트를 저장하고, 이후 후처리를 백그라운드로 넘깁니다.",
      },
      {
        id: "artifact",
        x: 760,
        y: 116,
        w: 330,
        h: 222,
        variant: "panel",
        accent: "teal",
        eyebrow: "구조화",
        title: "Source Artifact",
        rows: [
          { label: "section tree", value: "헤딩 기반 구조 보존" },
          { label: "metadata", value: "tags / category / excerpt" },
          { label: "provenance", value: "근거 위치 추적" },
        ],
      },
      {
        id: "candidate",
        x: 760,
        y: 408,
        w: 330,
        h: 236,
        variant: "panel",
        accent: "mint",
        eyebrow: "후보화",
        title: "Candidate Graph",
        rows: [
          { label: "node 후보", value: "root / topic / concept / alias" },
          { label: "edge 후보", value: "prerequisite / follow-up / duplicate" },
          { label: "승인 대기", value: "public 노출 전 분리" },
        ],
      },
      {
        id: "approved",
        x: 1160,
        y: 250,
        w: 330,
        h: 240,
        variant: "hero",
        accent: "navy",
        eyebrow: "공개",
        title: "Approved Graph",
        summary:
          "검증 가능한 node/edge/post link만 public WIKI TREE와 Knowledge Map에 반영합니다.",
        evidence: [
          { title: "Public WIKI TREE", meta: "트리 읽기 화면" },
          { title: "Knowledge Map", meta: "문서형 보드 화면" },
        ],
      },
      {
        id: "author",
        x: 1140,
        y: 604,
        w: 350,
        h: 196,
        variant: "panel",
        accent: "rose",
        eyebrow: "작성자 영역",
        title: "Candidate Inbox / Review",
        bullets: [
          "새 주제 후보 검토",
          "alias merge 확인",
          "provisional edge 승인",
        ],
      },
    ],
    connectors: [
      { id: "draft-mcp", from: "draft", to: "mcp", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "mcp-artifact", from: "mcp", to: "artifact", fromAnchor: "right", toAnchor: "left", tone: "secondary" },
      { id: "artifact-candidate", from: "artifact", to: "candidate", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "candidate-approved", from: "candidate", to: "approved", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "candidate-author", from: "candidate", to: "author", fromAnchor: "right", toAnchor: "left", tone: "dashed", label: "review" },
    ],
  },
  {
    id: "editorial-research-board",
    index: 4,
    name: "Editorial Research Board",
    category: "콘텐츠 기획 캔버스",
    surface: "whiteboard",
    blurb:
      "텍스트만 많은 Markdown이 아니라, 조사 주제, 핵심 질문, 증거, 산출물을 한 판에서 조직하는 편집형 보드 샘플입니다.",
    width: 1500,
    height: 1020,
    inspiration: {
      name: "tldraw",
      repo: "tldraw/tldraw",
      url: "https://github.com/tldraw/tldraw",
      note: "화이트보드 감성과 조사 노트/스티키 노트식 편집 흐름",
    },
    sourceExcerpt: `{
  "scene": "editorial-research-board",
  "lanes": ["question", "evidence", "angle", "output"],
  "panels": 4,
  "evidenceMode": "panel-local"
}`,
    nodes: [
      {
        id: "research-banner",
        x: 48,
        y: 36,
        w: 1404,
        h: 86,
        variant: "banner",
        accent: "teal",
        eyebrow: "Editorial Canvas",
        title: "리서치 노트에서 블로그 구조도로 넘어가는 편집형 보드",
      },
      {
        id: "question",
        x: 48,
        y: 180,
        w: 320,
        h: 290,
        variant: "panel",
        accent: "sand",
        eyebrow: "Question",
        title: "무엇을 답할 것인가",
        bullets: [
          "독자가 실제로 궁금해하는 질문",
          "한 문장으로 정의되는 핵심 주장",
          "어떤 비교와 기준이 필요한가",
        ],
      },
      {
        id: "evidence",
        x: 412,
        y: 180,
        w: 320,
        h: 314,
        variant: "panel",
        accent: "mint",
        eyebrow: "Evidence",
        title: "어떤 근거가 있는가",
        rows: [
          { label: "문서", value: "공식 문서와 스펙" },
          { label: "실험", value: "로컬 검증과 실행 결과" },
          { label: "제약", value: "비용, 성능, 유지보수" },
        ],
        evidence: [
          { title: "SDK 문서 검토", meta: "공식 레퍼런스" },
          { title: "로컬 재현 테스트", meta: "실행 로그" },
        ],
      },
      {
        id: "angle",
        x: 776,
        y: 180,
        w: 320,
        h: 290,
        variant: "panel",
        accent: "navy",
        eyebrow: "Angle",
        title: "어떤 관점으로 정리할 것인가",
        bullets: [
          "사용자 언어로 번역",
          "구현과 운영 관점 분리",
          "트레이드오프를 숨기지 않기",
        ],
      },
      {
        id: "output",
        x: 1140,
        y: 180,
        w: 312,
        h: 320,
        variant: "panel",
        accent: "rose",
        eyebrow: "Output",
        title: "최종 산출물",
        rows: [
          { label: "블로그 글", value: "서사 + 근거 + 시각화" },
          { label: "구조도", value: "읽는 흐름이 보이는 보드" },
          { label: "후속 액션", value: "다음 실험과 개선 항목" },
        ],
      },
      {
        id: "editorial-strip",
        x: 160,
        y: 612,
        w: 1180,
        h: 220,
        variant: "hero",
        accent: "navy",
        eyebrow: "Synthesis",
        title: "질문 → 근거 → 관점 → 산출물",
        summary:
          "캔버스 JSON은 이런 식으로 비대칭 배치, 패널별 evidence, 요약-근거-산출물 연결을 한 화면에 구성할 수 있습니다. Markdown 하나만으로는 잘 안 보이는 편집 판단을 공간 구조로 드러내는 데 유리합니다.",
      },
    ],
    connectors: [
      { id: "q-e", from: "question", to: "evidence", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "e-a", from: "evidence", to: "angle", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "a-o", from: "angle", to: "output", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "o-s", from: "output", to: "editorial-strip", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
    ],
  },
  {
    id: "sketch-planning-wall",
    index: 5,
    name: "Sketch Planning Wall",
    category: "스케치형 구상도",
    surface: "sketch",
    blurb:
      "손으로 그린 것처럼 느껴지는 loose한 기획 wall. 브리프, 위험, 실험, 출시 순서를 거친 아이디어 스케치 보드입니다.",
    width: 1460,
    height: 980,
    inspiration: {
      name: "Excalidraw",
      repo: "excalidraw/excalidraw",
      url: "https://github.com/excalidraw/excalidraw",
      note: "정밀한 엔터프라이즈 다이어그램보다 러프한 기획 스케치와 브레인스토밍에 강한 미감",
    },
    sourceExcerpt: `{
  "scene": "sketch-planning-wall",
  "style": "sketch",
  "clusters": ["문제", "가설", "실험", "출시 메모"]
}`,
    nodes: [
      {
        id: "sketch-banner",
        x: 80,
        y: 42,
        w: 1300,
        h: 84,
        variant: "banner",
        accent: "sand",
        eyebrow: "Sketch",
        title: "러프한 아이디어를 빠르게 구조화하는 스케치 플래닝 월",
      },
      {
        id: "problem-cloud",
        x: 84,
        y: 188,
        w: 300,
        h: 254,
        variant: "panel",
        accent: "rose",
        eyebrow: "문제",
        title: "사용자가 겪는 마찰",
        bullets: [
          "지식 그래프가 너무 기술적으로 보임",
          "포스트와 위키 흐름이 따로 놀음",
          "가이드/범례가 많아질수록 읽기 싫어짐",
        ],
      },
      {
        id: "hypothesis-cloud",
        x: 472,
        y: 148,
        w: 340,
        h: 300,
        variant: "hero",
        accent: "navy",
        eyebrow: "가설",
        title: "문서처럼 읽히는 구조도가 신뢰를 높인다",
        summary:
          "사용자는 구조와 흐름을 먼저 보고 싶어한다. 그래서 위계, 근거, 연결이 카드와 위치 안에서 바로 읽혀야 한다.",
      },
      {
        id: "experiments-cloud",
        x: 906,
        y: 222,
        w: 290,
        h: 238,
        variant: "panel",
        accent: "mint",
        eyebrow: "실험",
        title: "검증할 변화",
        rows: [
          { label: "문서형 보드", value: "범례 없이도 흐름이 읽히는지" },
          { label: "패널별 근거", value: "각 분기 신뢰도가 오르는지" },
          { label: "트리 연동", value: "탐색 피로가 줄어드는지" },
        ],
      },
      {
        id: "launch-notes",
        x: 340,
        y: 582,
        w: 760,
        h: 220,
        variant: "strip",
        accent: "teal",
        title: "출시 전 체크",
        summary: "브라우저 스크린샷 확인, 패널 overflow 0건, focus 이동 안정성, 미니맵 drag 품질, 패널별 evidence consistency",
      },
    ],
    connectors: [
      { id: "sketch-problem-hyp", from: "problem-cloud", to: "hypothesis-cloud", tone: "dashed" },
      { id: "sketch-hyp-exp", from: "hypothesis-cloud", to: "experiments-cloud", tone: "dashed" },
      { id: "sketch-hyp-launch", from: "hypothesis-cloud", to: "launch-notes", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
    ],
  },
  {
    id: "ops-orchestration-console",
    index: 6,
    name: "Ops Orchestration Console",
    category: "운영 콘솔 보드",
    surface: "editor",
    blurb:
      "상태와 라우팅이 중요한 운영용 그래프. 서비스, 큐, 작업기, 알림이 한 장에서 이어지는 운영 콘솔 스타일입니다.",
    width: 1500,
    height: 1020,
    inspiration: {
      name: "AntV X6",
      repo: "antvis/X6",
      url: "https://github.com/antvis/X6",
      note: "제품 수준의 그래프 에디터와 오퍼레이션 콘솔에 가까운 정제된 노드/엣지 스타일",
    },
    sourceExcerpt: `{
  "scene": "ops-orchestration-console",
  "style": "editor",
  "zones": ["ingest", "queues", "workers", "alerts"]
}`,
    nodes: [
      {
        id: "ops-entry",
        x: 60,
        y: 240,
        w: 240,
        h: 170,
        variant: "panel",
        accent: "teal",
        eyebrow: "Ingress",
        title: "Post Events",
        bullets: ["새 글 저장", "수정 이벤트", "리빌드 요청"],
      },
      {
        id: "ops-queue",
        x: 390,
        y: 224,
        w: 270,
        h: 206,
        variant: "hero",
        accent: "navy",
        eyebrow: "Queue",
        title: "knowledge:compile",
        summary: "artifact 생성, candidate 생성, approved sync를 비동기 잡으로 분리해 처리",
      },
      {
        id: "ops-workers",
        x: 770,
        y: 120,
        w: 300,
        h: 226,
        variant: "panel",
        accent: "mint",
        eyebrow: "Workers",
        title: "Pipeline Workers",
        rows: [
          { label: "artifact", value: "section tree + metadata 추출" },
          { label: "candidate", value: "alias / node / edge 후보 생성" },
          { label: "public", value: "approved graph 반영" },
        ],
      },
      {
        id: "ops-observer",
        x: 770,
        y: 440,
        w: 300,
        h: 210,
        variant: "panel",
        accent: "sand",
        eyebrow: "Metrics",
        title: "Observation",
        rows: [
          { label: "실패율", value: "rebuild / post link 충돌 감시" },
          { label: "queue lag", value: "포스트 저장 후 반영 시간 추적" },
          { label: "candidate drift", value: "새 root 후보 누적량 확인" },
        ],
      },
      {
        id: "ops-out",
        x: 1170,
        y: 240,
        w: 260,
        h: 188,
        variant: "panel",
        accent: "rose",
        eyebrow: "Output",
        title: "Public KB",
        bullets: ["WIKI TREE", "지식 지도", "노드 상세"],
      },
    ],
    connectors: [
      { id: "ops-a", from: "ops-entry", to: "ops-queue", tone: "primary" },
      { id: "ops-b", from: "ops-queue", to: "ops-workers", tone: "primary" },
      { id: "ops-c", from: "ops-workers", to: "ops-out", fromAnchor: "right", toAnchor: "left", tone: "primary" },
      { id: "ops-d", from: "ops-queue", to: "ops-observer", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
      { id: "ops-e", from: "ops-observer", to: "ops-out", fromAnchor: "right", toAnchor: "bottom", tone: "dashed" },
    ],
  },
  {
    id: "approval-bpmn-lanes",
    index: 7,
    name: "Approval BPMN Lanes",
    category: "스윔레인 워크플로우",
    surface: "workflow",
    blurb:
      "작성자, 운영자, 시스템의 책임을 lane으로 구분하는 절차형 보드. 승인/반려/보류 흐름이 명확한 구조입니다.",
    width: 1520,
    height: 1040,
    inspiration: {
      name: "LogicFlow",
      repo: "didi/LogicFlow",
      url: "https://github.com/didi/LogicFlow",
      note: "BPMN/플로우차트 계열의 선명한 절차 시각화와 lane 개념",
    },
    sourceExcerpt: `{
  "scene": "approval-bpmn-lanes",
  "style": "workflow",
  "lanes": ["작성자", "시스템", "운영자"]
}`,
    nodes: [
      {
        id: "lane-author",
        x: 60,
        y: 110,
        w: 1380,
        h: 190,
        variant: "strip",
        accent: "sand",
        title: "작성자 Lane · 새 주제 후보 확인",
        summary: "새 주제를 확인하고, 설명과 근거가 충분한지 메모를 남기는 단계",
      },
      {
        id: "lane-system",
        x: 60,
        y: 342,
        w: 1380,
        h: 190,
        variant: "strip",
        accent: "teal",
        title: "시스템 Lane · artifact / candidate 계산",
        summary: "source artifact를 만들고 기존 alias와 candidate cluster를 비교하는 단계",
      },
      {
        id: "lane-admin",
        x: 60,
        y: 574,
        w: 1380,
        h: 190,
        variant: "strip",
        accent: "navy",
        title: "운영자 Lane · 승인 / 반려 / 병합",
        summary: "public graph로 올릴지, alias로 병합할지, provisional로 남길지 판단하는 단계",
      },
      {
        id: "lane-end",
        x: 460,
        y: 828,
        w: 580,
        h: 146,
        variant: "hero",
        accent: "mint",
        eyebrow: "결과",
        title: "Approved Graph 또는 Candidate Inbox",
        summary: "공개 가능한 truth graph와 운영 검토용 후보 inbox가 분리된다는 점이 핵심",
      },
    ],
    connectors: [
      { id: "lane-1", from: "lane-author", to: "lane-system", fromAnchor: "bottom", toAnchor: "top", tone: "primary" },
      { id: "lane-2", from: "lane-system", to: "lane-admin", fromAnchor: "bottom", toAnchor: "top", tone: "primary" },
      { id: "lane-3", from: "lane-admin", to: "lane-end", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
    ],
  },
  {
    id: "systems-wiring-board",
    index: 8,
    name: "Systems Wiring Board",
    category: "엔지니어링 와이어링",
    surface: "studio",
    blurb:
      "데이터/이벤트/리드 모델을 같은 판에서 배선처럼 보여주는 엔지니어링용 구조도. 선의 질감과 포트 감각이 중요한 스타일입니다.",
    width: 1500,
    height: 980,
    inspiration: {
      name: "react-diagrams",
      repo: "projectstorm/react-diagrams",
      url: "https://github.com/projectstorm/react-diagrams",
      note: "포트 중심 연결과 엔지니어링 와이어링에 가까운 노드 배선 스타일",
    },
    sourceExcerpt: `{
  "scene": "systems-wiring-board",
  "style": "studio",
  "modules": ["input", "resolver", "storage", "viewer"]
}`,
    nodes: [
      { id: "wire-input", x: 80, y: 290, w: 250, h: 168, variant: "panel", accent: "sand", eyebrow: "Input", title: "Raw Posts", bullets: ["제목", "본문", "태그", "카테고리"] },
      {
        id: "wire-resolver",
        x: 470,
        y: 226,
        w: 320,
        h: 220,
        variant: "hero",
        accent: "navy",
        eyebrow: "Resolver",
        title: "Artifact + Candidate Resolver",
        summary: "source artifact, alias match, candidate cluster, approval target을 모두 판별하는 핵심 모듈",
      },
      { id: "wire-storage", x: 930, y: 142, w: 280, h: 188, variant: "panel", accent: "teal", eyebrow: "Store", title: "Approved Graph", bullets: ["nodes", "edges", "post links"] },
      { id: "wire-candidate", x: 930, y: 410, w: 280, h: 188, variant: "panel", accent: "mint", eyebrow: "Store", title: "Candidate Graph", bullets: ["provisional nodes", "alias queue", "review flags"] },
      { id: "wire-viewer", x: 1260, y: 278, w: 180, h: 168, variant: "panel", accent: "rose", eyebrow: "Viewer", title: "KB UI", bullets: ["tree", "map", "detail"] },
    ],
    connectors: [
      { id: "wire-a", from: "wire-input", to: "wire-resolver", tone: "primary" },
      { id: "wire-b", from: "wire-resolver", to: "wire-storage", tone: "primary" },
      { id: "wire-c", from: "wire-resolver", to: "wire-candidate", tone: "secondary" },
      { id: "wire-d", from: "wire-storage", to: "wire-viewer", tone: "primary" },
      { id: "wire-e", from: "wire-candidate", to: "wire-viewer", tone: "dashed" },
    ],
  },
  {
    id: "visual-programming-chain",
    index: 9,
    name: "Visual Programming Chain",
    category: "비주얼 프로그래밍",
    surface: "editor",
    blurb:
      "노드가 곧 함수 블록처럼 보이는 비주얼 프로그래밍 스타일. 입력, 변환, 라우팅, 출력이 도구적인 미감으로 보입니다.",
    width: 1500,
    height: 980,
    inspiration: {
      name: "Rete",
      repo: "retejs/rete",
      url: "https://github.com/retejs/rete",
      note: "비주얼 프로그래밍과 데이터 플로우 편집기 계열의 블록 체인형 구조",
    },
    sourceExcerpt: `{
  "scene": "visual-programming-chain",
  "style": "editor",
  "chain": ["parse", "normalize", "score", "publish"]
}`,
    nodes: [
      { id: "prog-parse", x: 90, y: 320, w: 220, h: 170, variant: "panel", accent: "sand", eyebrow: "Node 01", title: "Parse", rows: [{ label: "input", value: "markdown / html / metadata" }] },
      { id: "prog-normalize", x: 390, y: 270, w: 270, h: 220, variant: "hero", accent: "teal", eyebrow: "Node 02", title: "Normalize", rows: [{ label: "slug", value: "정규화" }, { label: "alias", value: "기존 후보와 비교" }, { label: "root", value: "candidate로 분기" }] },
      { id: "prog-score", x: 780, y: 220, w: 280, h: 228, variant: "panel", accent: "navy", eyebrow: "Node 03", title: "Score / Resolve", rows: [{ label: "signals", value: "반복 출현, evidence 수" }, { label: "decision", value: "approve / provisional" }] },
      { id: "prog-publish", x: 1170, y: 270, w: 220, h: 180, variant: "panel", accent: "mint", eyebrow: "Node 04", title: "Publish", rows: [{ label: "target", value: "public tree + map" }] },
      { id: "prog-strip", x: 280, y: 642, w: 880, h: 164, variant: "strip", accent: "rose", title: "비주얼 프로그래밍 스타일은 자동화 파이프라인과 운영 도구 화면에 특히 잘 어울립니다.", summary: "반면 블로그 본문용 구조도는 너무 도구적으로 보일 수 있어, public article surface에는 조금 더 문서적인 변주가 필요합니다." },
    ],
    connectors: [
      { id: "prog-a", from: "prog-parse", to: "prog-normalize", tone: "primary" },
      { id: "prog-b", from: "prog-normalize", to: "prog-score", tone: "primary" },
      { id: "prog-c", from: "prog-score", to: "prog-publish", tone: "primary" },
      { id: "prog-d", from: "prog-score", to: "prog-strip", fromAnchor: "bottom", toAnchor: "top", tone: "secondary" },
    ],
  },
  {
    id: "cluster-explorer-map",
    index: 10,
    name: "Cluster Explorer Map",
    category: "네트워크 탐색형",
    surface: "network",
    blurb:
      "중심 개념과 주변 클러스터를 동시에 보는 네트워크 탐색형 샘플. 지식지도나 관계망 브라우저의 분위기를 비교하기 위한 예시입니다.",
    width: 1500,
    height: 1020,
    inspiration: {
      name: "Cytoscape.js",
      repo: "cytoscape/cytoscape.js",
      url: "https://github.com/cytoscape/cytoscape.js",
      note: "관계망/클러스터 탐색에 강한 네트워크 시각화 계열",
    },
    sourceExcerpt: `{
  "scene": "cluster-explorer-map",
  "style": "network",
  "clusters": ["정책", "운영", "콘텐츠", "데이터"]
}`,
    nodes: [
      {
        id: "cluster-core",
        x: 540,
        y: 280,
        w: 420,
        h: 230,
        variant: "hero",
        accent: "navy",
        eyebrow: "Core",
        title: "지식 시스템 중심 개념",
        summary: "정책, 운영, 데이터, 콘텐츠가 만나서 public KB 경험을 결정하는 중심 허브",
      },
      { id: "cluster-policy", x: 180, y: 160, w: 280, h: 188, variant: "panel", accent: "sand", eyebrow: "Cluster", title: "정책", bullets: ["허용/금지 기준", "검수 흐름", "공개 규칙"] },
      { id: "cluster-ops", x: 1040, y: 144, w: 280, h: 188, variant: "panel", accent: "mint", eyebrow: "Cluster", title: "운영", bullets: ["큐 처리", "실패 복구", "관측"] },
      { id: "cluster-content", x: 140, y: 624, w: 300, h: 200, variant: "panel", accent: "rose", eyebrow: "Cluster", title: "콘텐츠", bullets: ["자동포스팅", "위키 상세", "구조도 본문"] },
      { id: "cluster-data", x: 1060, y: 628, w: 300, h: 200, variant: "panel", accent: "teal", eyebrow: "Cluster", title: "데이터", bullets: ["artifacts", "candidate graph", "approved graph"] },
    ],
    connectors: [
      { id: "cluster-a", from: "cluster-policy", to: "cluster-core", tone: "primary" },
      { id: "cluster-b", from: "cluster-ops", to: "cluster-core", tone: "primary" },
      { id: "cluster-c", from: "cluster-content", to: "cluster-core", tone: "primary" },
      { id: "cluster-d", from: "cluster-data", to: "cluster-core", tone: "primary" },
      { id: "cluster-e", from: "cluster-policy", to: "cluster-content", tone: "dashed" },
      { id: "cluster-f", from: "cluster-ops", to: "cluster-data", tone: "dashed" },
    ],
  },
];
