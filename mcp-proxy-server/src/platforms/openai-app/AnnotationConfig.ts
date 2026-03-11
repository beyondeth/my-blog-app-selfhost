export const OPENAI_MVP_TOOL_NAMES = [
  'check_auth',
  'list_my_published_posts',
  'search_my_published_posts',
  'read_my_published_post',
  'render_style_picker',
  'confirm_style',
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
  list_my_published_posts: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  search_my_published_posts: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  read_my_published_post: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  render_style_picker: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  confirm_style: {
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
