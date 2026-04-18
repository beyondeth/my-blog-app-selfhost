import {
  getKnowledgeNodeCanonicalRoot,
  resolveKnowledgeSourceTaxonomy,
} from "./knowledge-taxonomy.util";

describe("knowledge-taxonomy.util", () => {
  it("normalizes explicit root/topic categories into canonical taxonomy", () => {
    const taxonomy = resolveKnowledgeSourceTaxonomy({
      category: "건강/회복",
      categorySegments: ["건강", "회복"],
    });

    expect(taxonomy.root).toMatchObject({ title: "건강", slug: "건강" });
    expect(taxonomy.topic).toMatchObject({ title: "회복", slug: "회복" });
  });

  it("demotes one-segment root aliases into topics under the canonical root", () => {
    const taxonomy = resolveKnowledgeSourceTaxonomy({
      category: "운동",
      categorySegments: ["운동"],
    });

    expect(taxonomy.root).toMatchObject({ title: "건강", slug: "건강" });
    expect(taxonomy.topic).toMatchObject({ title: "운동", slug: "운동" });
  });

  it("extracts bracketed category labels into root/topic pairs", () => {
    const taxonomy = resolveKnowledgeSourceTaxonomy({
      category: "[건강] 글쓰기: 의도",
      categorySegments: ["[건강] 글쓰기: 의도"],
    });

    expect(taxonomy.root).toMatchObject({ title: "건강", slug: "건강" });
    expect(taxonomy.topic).toMatchObject({ title: "글쓰기", slug: "글쓰기" });
  });

  it("collapses noisy numeric roots into the generic bucket", () => {
    const taxonomy = resolveKnowledgeSourceTaxonomy({
      category: "123",
      categorySegments: ["123"],
    });

    expect(taxonomy.root).toMatchObject({ title: "기타", slug: "기타" });
    expect(taxonomy.topic).toBeNull();
  });

  it("derives the same canonical root from noisy node metadata", () => {
    const techRoot = getKnowledgeNodeCanonicalRoot({
      title: "Tech",
      slug: "tech",
      canonicalPath: "/tech",
    });
    const legacyHealthRoot = getKnowledgeNodeCanonicalRoot({
      title: "[건강] 글쓰기: 의도",
      slug: "건강-글쓰기-의도",
      canonicalPath: "/건강-글쓰기-의도",
    });

    expect(techRoot).toMatchObject({ title: "개발", slug: "개발" });
    expect(legacyHealthRoot).toMatchObject({ title: "건강", slug: "건강" });
  });

  it("keeps unknown roots as open-world candidates instead of collapsing them into generic buckets", () => {
    const taxonomy = resolveKnowledgeSourceTaxonomy({
      category: "우주/관측",
      categorySegments: ["우주", "관측"],
    });
    const openRoot = getKnowledgeNodeCanonicalRoot({
      title: "우주",
      slug: "우주",
      canonicalPath: "/우주/관측",
    });

    expect(taxonomy.root).toMatchObject({ title: "우주", slug: "우주" });
    expect(taxonomy.topic).toMatchObject({ title: "관측", slug: "관측" });
    expect(openRoot).toMatchObject({ title: "우주", slug: "우주" });
  });
});
