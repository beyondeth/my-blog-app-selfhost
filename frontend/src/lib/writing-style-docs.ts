export type WritingStyleDoc = {
  id: string;
  name: string;
  flag: string;
  summary: string;
  bestFor: string;
  kind: 'preset' | 'special' | 'reference';
};

export const WRITING_STYLE_PRESET_DOCS: WritingStyleDoc[] = [
  {
    id: 'default',
    name: 'Default',
    flag: '--default',
    summary: 'The default style for balanced technical explanation, implementation context, and practical clarity.',
    bestFor: 'General technical blogs, implementation retrospectives, architecture explanations',
    kind: 'preset',
  },
  {
    id: 'novel',
    name: 'Novel',
    flag: '--novel',
    summary: 'Best for narrative writing with tension, turning points, and a clear emotional arc.',
    bestFor: 'Incident retrospectives, founder stories, experience-driven essays',
    kind: 'preset',
  },
  {
    id: 'podcast',
    name: 'Podcast',
    flag: '--podcast',
    summary: 'A conversational style that delivers the key ideas quickly through a question-and-answer rhythm.',
    bestFor: 'Explainer Q&A, spoken-content scripts, interview summaries',
    kind: 'preset',
  },
  {
    id: 'vibe',
    name: 'Vibe',
    flag: '--vibe',
    summary: 'Uses a mentor-like tone and insight-led structure to highlight growth moments.',
    bestFor: 'Learning guides, career insights, practical know-how posts',
    kind: 'preset',
  },
  {
    id: 'research',
    name: 'Research',
    flag: '--research',
    summary: 'An analytical style built around evidence, comparison, and explicit constraints.',
    bestFor: 'Paper reviews, benchmarks, option comparisons',
    kind: 'preset',
  },
  {
    id: 'pm',
    name: 'PM',
    flag: '--pm',
    summary: 'A product-focused tone that makes problem framing, decision criteria, and tradeoffs explicit.',
    bestFor: 'Launch retrospectives, product strategy, prioritization decisions',
    kind: 'preset',
  },
  {
    id: 'designer',
    name: 'Designer',
    flag: '--designer',
    summary: 'A case-study tone that explains context, exploration, and user impact in a structured way.',
    bestFor: 'Redesign notes, UX case studies, interaction write-ups',
    kind: 'preset',
  },
  {
    id: 'marketer',
    name: 'Marketer',
    flag: '--marketer',
    summary: 'Organizes hypotheses, experiments, conversion changes, and metrics into a persuasive narrative.',
    bestFor: 'Campaign retrospectives, funnel analysis, growth experiment reports',
    kind: 'preset',
  },
];

export const WRITING_STYLE_SPECIAL_MODE_DOCS: WritingStyleDoc[] = [
  {
    id: 'sell',
    name: 'Sell',
    flag: '--sell',
    summary: 'Use `--sell` with a standard writing style to register the post as a marketplace product.',
    bestFor: 'Prompt packs, templates, paid guides, workflow products',
    kind: 'special',
  },
];

export const WRITING_STYLE_REFERENCE_DOCS: WritingStyleDoc[] = [
  {
    id: '_common',
    name: 'Common Rules',
    flag: 'shared rules',
    summary: 'Shared rules for tags, Markdown, and parameters that apply to every preset and sell mode.',
    bestFor: 'Reviewing shared publishing rules before choosing a style',
    kind: 'reference',
  },
];

export const WRITING_STYLE_DOCS: WritingStyleDoc[] = [
  ...WRITING_STYLE_PRESET_DOCS,
  ...WRITING_STYLE_SPECIAL_MODE_DOCS,
  ...WRITING_STYLE_REFERENCE_DOCS,
];

export const WRITING_STYLE_DOCS_BY_ID = Object.fromEntries(
  WRITING_STYLE_DOCS.map((style) => [style.id, style]),
) as Record<string, WritingStyleDoc>;
