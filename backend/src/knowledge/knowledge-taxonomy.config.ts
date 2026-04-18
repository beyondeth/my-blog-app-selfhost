export interface KnowledgeTaxonomyRootDefinition {
  title: string;
  aliases: string[];
  generic?: boolean;
}

// Bootstrap seed only.
// These aliases help cold-start canonicalization, but they no longer define
// the full set of allowed KB roots. Unknown roots can remain open-world
// candidates and later graduate into approved roots.
export const KNOWLEDGE_TAXONOMY_ROOTS: KnowledgeTaxonomyRootDefinition[] = [
  {
    title: "개발",
    aliases: [
      "개발",
      "기술",
      "tech",
      "technology",
      "engineering",
      "database",
      "ai",
      "frontend",
      "backend",
      "프로그래밍",
      "반도체",
      "software",
      "devops",
      "cloud",
      "data",
    ],
  },
  {
    title: "지식",
    aliases: [
      "지식",
      "과학",
      "책",
      "도서",
      "도서리뷰",
      "독서",
      "education",
      "교육",
      "언어",
      "언어학",
      "철학",
      "논증",
      "연구",
    ],
  },
  {
    title: "건강",
    aliases: ["건강", "운동", "회복", "심리", "심리학", "수면", "루틴"],
  },
  {
    title: "생활",
    aliases: [
      "생활",
      "일상",
      "정원",
      "요리",
      "마을",
      "취미",
      "습관",
      "저널링",
      "일상관리",
      "글쓰기",
    ],
  },
  {
    title: "문화",
    aliases: [
      "문화",
      "공연",
      "지역",
      "동화",
      "예술",
      "미술관",
      "음악",
      "관광",
      "여행",
      "번역",
      "공예",
    ],
  },
  {
    title: "경제",
    aliases: ["경제", "마케팅", "비즈니스", "소비"],
  },
  {
    title: "정책",
    aliases: ["정책", "정치", "사회", "생태", "환경"],
  },
  {
    title: "기타",
    aliases: ["기타", "general"],
    generic: true,
  },
];
