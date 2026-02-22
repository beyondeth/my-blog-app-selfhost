export const OPENAI_MVP_TOOL_NAMES = [
  'check_auth',
  'get_writing_style_guide',
  'create_post',
] as const;

export type OpenAiMvpToolName = (typeof OPENAI_MVP_TOOL_NAMES)[number];

export const ANNOTATIONS: Record<
  OpenAiMvpToolName,
  { readOnlyHint: boolean; openWorldHint: boolean; destructiveHint: boolean }
> = {
  check_auth: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  get_writing_style_guide: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  create_post: {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  },
};

