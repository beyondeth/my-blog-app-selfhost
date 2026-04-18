import { CreatePostDto } from "../posts/dto/create-post.dto";

export type SeedKnowledgeMockOptions = {
  count: number;
  blogAlias: string;
  prefix?: string;
  includeHashtags?: boolean;
};

export type SeedKnowledgeMockPost = CreatePostDto & {
  content_markdown: string;
};

type TopicBundle = {
  domain: string;
  topics: string[];
  verbs: string[];
  details: string[];
};

const TOPICS: TopicBundle[] = [
  {
    domain: "생활",
    topics: ["루틴", "정리", "습관", "식단", "심리", "습득", "휴식", "가전", "공간", "가치"],
    verbs: [
      "바꾸는",
      "설계하는",
      "관리하는",
      "확장하는",
      "정비하는",
      "누적하는",
    ],
    details: [
      "실행 순서를 기준으로",
      "실패 포인트를 제거하고",
      "기대효과를 측정하며",
      "일상 패턴을 안정화하고",
      "루틴 지속률을 높이는",
      "다음 단계로 확장할 수 있게",
    ],
  },
  {
    domain: "문화",
    topics: ["영화", "음악", "전시", "요리", "축제", "취미", "패션", "디자인", "여행", "공연"],
    verbs: ["조명하는", "기록하는", "비교하는", "감상하는", "해석하는", "재구성하는"],
    details: [
      "맥락을 세분화하고",
      "관점별 차이를 정리하며",
      "취향 히스토리를 축적하고",
      "관람 후 회고를 구조화해",
      "선택 기준을 설명하는",
      "현대적 기준으로 재해석한",
    ],
  },
  {
    domain: "언어",
    topics: ["문법", "발음", "회화", "번역", "읽기", "쓰기", "어휘", "문체", "발표", "자막"],
    verbs: ["정리하는", "연습하는", "개선하는", "분해하는", "보완하는", "검증하는"],
    details: [
      "오류 패턴을 추적하고",
      "문장 단위를 정렬해",
      "표현력을 확장하는",
      "학습 피드백을 수집해",
      "발화 정확도를 높이는",
      "장기 기억으로 누적되는",
    ],
  },
  {
    domain: "지식",
    topics: ["과학", "철학", "기술", "사회", "심리", "경영", "교육", "역사", "철학", "데이터"],
    verbs: ["요약하는", "연결하는", "검증하는", "비교하는", "구조화하는", "응용하는"],
    details: [
      "근거 중심으로 정리하고",
      "추론 과정을 기록해",
      "메타인지 관점으로",
      "교차 검증 가능한 구조로",
      "실무에 바로 적용될 수 있게",
      "학습 지도를 설계한",
    ],
  },
  {
    domain: "책",
    topics: ["독서", "서평", "논픽션", "소설", "고전", "철학서", "자기계발", "에세이", "추천", "서지"],
    verbs: ["읽는", "해설하는", "정리하는", "연결하는", "요약하는", "비평하는"],
    details: [
      "챕터 단위로 정리하고",
      "키워드로 압축해",
      "해석 차이를 비교하며",
      "실제 적용 포인트를 뽑아",
      "토론용 질문으로 확장한",
      "지식 체인으로 엮은",
    ],
  },
  {
    domain: "지역",
    topics: ["서울", "부산", "대구", "강릉", "경주", "제주", "공원", "시장", "골목", "동네"],
    verbs: ["탐색하는", "기록하는", "연결하는", "경로를 짜는", "비교하는", "정리하는"],
    details: [
      "동선 기반으로 정리하고",
      "현지 맥락을 반영해",
      "체크리스트를 포함한",
      "여행 계획을 안정적으로",
      "이동 동선을 단순화하고",
      "현지자원 기준으로",
    ],
  },
];

const BASE_TAG_POOLS = [
  "실천",
  "체계화",
  "메모",
  "지식관리",
  "워크플로",
  "생산성",
  "카테고리",
  "회고",
  "아이디어",
  "독서",
  "연결",
  "실험",
  "실전",
  "정리",
  "학습",
];

export function sanitizeBlogAlias(rawAlias: string): string {
  return (rawAlias || "").replace(/^@/, "").trim();
}

export function parseSeedArgs(rawArgs: string[] = []): {
  count: number;
  blog: string;
  prefix: string;
  dryRun: boolean;
} {
  const defaults = {
    count: 200,
    blog: "park1818",
    prefix: "KB",
    dryRun: false,
  };

  const getValue = (key: string): string | undefined => {
    const hit = rawArgs.find((value) => value.startsWith(`--${key}=`));
    if (!hit) return undefined;
    return hit.split("=").slice(1).join("=");
  };

  const has = (key: string): boolean =>
    rawArgs.includes(`--${key}`) ||
    rawArgs.includes(`--${key}=true`) ||
    rawArgs.includes(`--${key}=1`);

  const parseCount = Number(getValue("count") ?? defaults.count);
  const parsedCount = Number.isFinite(parseCount) && parseCount > 0 ? Math.trunc(parseCount) : defaults.count;
  const blog = sanitizeBlogAlias(
    getValue("blog") ?? getValue("slug") ?? defaults.blog,
  );
  const prefix = getValue("prefix") ?? defaults.prefix;
  const dryRun = has("dry-run") || has("dryRun");

  return {
    count: Math.min(parsedCount, 1000),
    blog: blog.length > 0 ? blog : defaults.blog,
    prefix,
    dryRun,
  };
}

export function buildKnowledgeMockPosts(
  options: SeedKnowledgeMockOptions,
): SeedKnowledgeMockPost[] {
  const payload: SeedKnowledgeMockPost[] = [];
  const topicCount = TOPICS.length;
  const totalCount = options.count;
  const seed = options.prefix ?? "KB";

  for (let i = 1; i <= totalCount; i++) {
    const domain = TOPICS[(i - 1) % topicCount];
    const topic = domain.topics[(i - 1) % domain.topics.length];
    const verb = domain.verbs[(Math.floor((i - 1) / 3)) % domain.verbs.length];
    const detail =
      domain.details[(Math.floor((i - 1) / 7)) % domain.details.length];
    const primary = domain.domain;
    const titleSuffix = `${seed}-${i.toString().padStart(3, "0")}`;
    const tagSeed = BASE_TAG_POOLS[(i - 1) % BASE_TAG_POOLS.length];
    const crossSeed = BASE_TAG_POOLS[(i + 5) % BASE_TAG_POOLS.length];
    const sectionIndex = (i - 1) % 3;
    const sectionTitle =
      sectionIndex === 0
        ? "핵심 개념"
        : sectionIndex === 1
          ? "실무 적용"
          : "점검 체크리스트";

    const title = `${primary} ${topic} ${verb} 노트 ${titleSuffix}`;
    const category = `${primary}/${topic}`;
    const markdown = `# ${title}\n\n## ${sectionTitle}\n- ${detail} 관점에서 정리한 학습 메모입니다.\n- ${primary} 영역의 핵심 주제를 ${topic} 중심으로 구조화했습니다.\n\n## 핵심 질문\n- 왜 이 주제가 중요한가?\n- 어떤 기준으로 우선순위를 정할 것인가?\n- 3개월 뒤에는 어떤 지표가 개선되었는가?\n\n## 실행 메모\n- 첫 7일: ${verb} 단계별 루틴을 확인한다.\n- 다음 14일: ${detail}를 기준으로 성과 노트를 남긴다.\n- 30일 후: 블로그 글과 노트 간 연결 관계를 점검한다.\n\n태그: ${tagSeed}, ${crossSeed}, ${primary}\n`;

    payload.push({
      title,
      content_markdown: markdown,
      content: markdown,
      tags: [primary, topic, tagSeed, crossSeed, options.blogAlias],
      category,
      isPublished: true,
      visibility: "public",
      qualityScore: 70 + (i % 30),
    });
  }

  return payload;
}
