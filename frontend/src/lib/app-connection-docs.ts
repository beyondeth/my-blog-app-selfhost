export type AppConnectionDocSlug = 'chatgpt' | 'perplexity' | 'claude';

export type AppConnectionStep = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  caption: string;
  note?: string;
};

export type AppConnectionDoc = {
  slug: AppConnectionDocSlug;
  title: string;
  shortTitle: string;
  summary: string;
  status: 'official-docs' | 'manual-verify';
  statusLabel: string;
  statusDescription: string;
  prerequisites: string[];
  steps: AppConnectionStep[];
  testChecklist: string[];
  troubleshooting: string[];
  sources: Array<{
    label: string;
    href: string;
    description: string;
  }>;
  lastVerified: string;
};

export const APP_CONNECTION_DOCS: AppConnectionDoc[] = [
  {
    slug: 'chatgpt',
    title: 'ChatGPT Web / App Connection',
    shortTitle: 'ChatGPT',
    summary:
      'A step-by-step guide to finding and connecting the Codebase app inside ChatGPT, based on OpenAI’s official apps documentation.',
    status: 'official-docs',
    statusLabel: 'Official docs confirmed',
    statusDescription:
      'OpenAI has consolidated the older "connectors" terminology into "apps". The current user-facing flow centers on ChatGPT Settings > Apps and the app directory.',
    prerequisites: [
      'Your Codebase workspace and the target app flow should already be ready to connect.',
      'You must be signed in to ChatGPT, and Apps must be available for your current plan or workspace.',
      'On workspace plans, admin settings can affect whether custom apps are available.',
    ],
    steps: [
      {
        title: 'Open the Apps entry point in ChatGPT',
        description:
          'Start from Settings > Apps or the app directory, following OpenAI’s official help docs. The exact UI labels can vary by plan and workspace settings.',
        imageSrc: '/docs/apps/chatgpt/01-entry.png',
        imageAlt: 'Screenshot of ChatGPT Settings > Apps',
        caption:
          'Replace this slot with a screenshot of where Apps appears inside ChatGPT.',
      },
      {
        title: 'Find the Codebase app or custom app flow',
        description:
          'Look for Codebase directly in the app directory. If a custom app flow is available, start the connection from there instead.',
        imageSrc: '/docs/apps/chatgpt/02-open-connect.png',
        imageAlt: 'Screenshot of the ChatGPT app directory or custom app connect flow',
        caption:
          'Replace this slot with a screenshot of the connect button or custom app add flow.',
      },
      {
        title: 'Finish sign-in and authorization',
        description:
          'If ChatGPT or Codebase shows a sign-in or permission prompt, approve it after reviewing the requested access. On first connect, double-check any data-sharing or usage permissions.',
        imageSrc: '/docs/apps/chatgpt/03-auth.png',
        imageAlt: 'Screenshot of ChatGPT app authorization',
        caption:
          'Replace this slot with the sign-in or authorization screen.',
      },
      {
        title: 'Confirm that the app can be invoked in chat',
        description:
          'According to OpenAI’s docs, apps can be used via @ mention or the + menu in the composer. After connecting, call Codebase from a chat and run a quick test.',
        imageSrc: '/docs/apps/chatgpt/04-complete.png',
        imageAlt: 'Screenshot of the Codebase app appearing in a ChatGPT conversation',
        caption:
          'Replace this slot with the post-connection state where Codebase is available in chat.',
      },
    ],
    testChecklist: [
      'Confirm that Codebase appears as connected in Settings > Apps.',
      'Confirm that Codebase can be selected via @ mention or the + menu.',
      'Run a short test prompt and verify that the app responds.',
    ],
    troubleshooting: [
      'If Apps does not appear, first check your plan, regional rollout status, and any workspace policy restrictions.',
      'If custom apps are missing, confirm that the workspace admin allows Drafts or custom apps.',
      'If the app still does not invoke after authorization, disconnect it, reconnect it, and open a fresh chat.',
    ],
    sources: [
      {
        label: 'Apps in ChatGPT',
        href: 'https://help.openai.com/en/articles/11487775-apps-in-chatgpt',
        description: 'User-facing app connection flow, including Settings > Apps, the app directory, and @ mention usage.',
      },
      {
        label: 'Introducing apps in ChatGPT',
        href: 'https://openai.com/index/introducing-apps-in-chatgpt/',
        description: 'Background on OpenAI’s apps terminology and the Apps SDK platform.',
      },
    ],
    lastVerified: '2026-04-17',
  },
  {
    slug: 'perplexity',
    title: 'Perplexity Web / App Verification',
    shortTitle: 'Perplexity',
    summary:
      'Perplexity does not currently document a confirmed end-user flow for connecting an external remote MCP server such as Codebase inside the Perplexity web or mobile app. This page is a verification checklist rather than a finished setup guide.',
    status: 'manual-verify',
    statusLabel: 'Manual verification required',
    statusDescription:
      'The currently confirmed Perplexity docs describe how to connect Perplexity’s own MCP server to other MCP clients. Whether the Perplexity web or mobile app exposes a user-facing UI for external remote MCP servers still needs direct product verification.',
    prerequisites: [
      'You need an active Perplexity account and access to the exact product surface you plan to test.',
      'Before claiming support, verify whether that surface allows external tools, apps, integrations, or MCP connections at all.',
      'Until support is confirmed, do not present this page as a general end-user setup guide.',
    ],
    steps: [
      {
        title: 'Look for an external connection entry point in the Perplexity UI',
        description:
          'Check whether the current product surface actually exposes something like Settings, Integrations, Apps, Tools, or MCP. If no such entry point exists, record that this surface does not support external remote MCP connections.',
        imageSrc: '/docs/apps/perplexity/01-entry.png',
        imageAlt: 'Screenshot used to verify a Perplexity settings or integrations entry point',
        caption:
          'Replace this slot with a screenshot showing whether an external connection menu exists.',
        note:
          'This step is specifically about product verification. If the menu does not exist, stop here.',
      },
      {
        title: 'Check for an external remote MCP or custom integration flow',
        description:
          'Verify whether the UI allows you to enter an external server URL or configure a custom integration. Perplexity’s official MCP docs cover the opposite direction, so this still requires direct UI validation.',
        imageSrc: '/docs/apps/perplexity/02-open-connect.png',
        imageAlt: 'Screenshot used to verify an external MCP connection form in Perplexity',
        caption:
          'Replace this slot if you find a real external MCP or custom integration form.',
        note:
          'If no such form exists, keep this document in the unsupported or unverified state.',
      },
      {
        title: 'Capture the connected state only if support is confirmed',
        description:
          'Only after a real connection flow is confirmed should you document the connected state, invocation pattern, and test prompt for Codebase.',
        imageSrc: '/docs/apps/perplexity/03-complete.png',
        imageAlt: 'Screenshot used to verify a completed Perplexity connection state',
        caption:
          'Replace this slot with a real connected-state screenshot after support is verified.',
        note:
          'Until you have a real post-connection screenshot, keep the placeholder and leave the page marked as manually verified.',
      },
    ],
    testChecklist: [
      'Record whether the Perplexity UI exposes any external connection or custom integration entry point.',
      'Record whether it accepts an external remote MCP URL.',
      'If it is unavailable, mark it unsupported. If it exists, note whether it is beta or preview only and what plan is required.',
    ],
    troubleshooting: [
      'First confirm whether the linked Perplexity docs describe inbound or outbound MCP support.',
      'If the actual product UI has no connection menu, do not claim that external MCP is supported.',
      'Until support is verified, keep this page positioned as an internal validation note rather than a public how-to.',
    ],
    sources: [
      {
        label: 'Perplexity MCP Server',
        href: 'https://docs.perplexity.ai/docs/getting-started/integrations/mcp-server',
        description:
          'Official docs for connecting Perplexity’s MCP server to other clients such as Cursor, VS Code, or Claude Code.',
      },
    ],
    lastVerified: '2026-04-17',
  },
  {
    slug: 'claude',
    title: 'Claude Web / Mobile Connection',
    shortTitle: 'Claude',
    summary:
      'A guide to adding a custom connector via remote MCP in claude.ai and then using it across the web and mobile apps, based on Anthropic’s official support docs.',
    status: 'official-docs',
    statusLabel: 'Official docs confirmed',
    statusDescription:
      'Claude officially supports custom connectors using remote MCP. A connector added on the web can generally be used in Claude Mobile, but adding a brand-new server is still safest on the web.',
    prerequisites: [
      'Your Codebase remote MCP endpoint must be reachable from the public internet.',
      'Your Claude account and plan must expose custom connector support.',
      'Only connect remote MCP servers that you trust.',
    ],
    steps: [
      {
        title: 'Open the Connectors settings in Claude',
        description:
          'Start in claude.ai at Settings > Connectors, following Anthropic’s support guide. If you already have connectors configured, look for the custom integration entry point beneath the current list.',
        imageSrc: '/docs/apps/claude/01-entry.png',
        imageAlt: 'Screenshot of Claude Settings > Connectors',
        caption:
          'Replace this slot with a screenshot showing where Connectors appears in Claude web.',
      },
      {
        title: 'Start the custom integration or remote MCP flow',
        description:
          'This is the step where you enter the Codebase remote MCP server details. The exact label may vary, such as Add custom integration, custom connector, or remote MCP.',
        imageSrc: '/docs/apps/claude/02-open-connect.png',
        imageAlt: 'Screenshot of Claude custom connector setup',
        caption:
          'Replace this slot with the remote MCP or custom integration entry screen.',
      },
      {
        title: 'Complete OAuth and approve access',
        description:
          'Anthropic’s support docs note that custom connectors often use OAuth. Review the requested access carefully and only approve the scopes that are actually required.',
        imageSrc: '/docs/apps/claude/03-auth.png',
        imageAlt: 'Screenshot of Claude custom connector OAuth authorization',
        caption:
          'Replace this slot with the Codebase authorization screen shown during Claude setup.',
      },
      {
        title: 'Test it on the web and confirm mobile availability',
        description:
          'After connecting, verify that the connector can be invoked in Claude conversations on the web. Anthropic notes that an already-added remote server may be available on mobile as well, but initial setup is best handled on the web.',
        imageSrc: '/docs/apps/claude/04-complete.png',
        imageAlt: 'Screenshot of a connected Claude conversation using the connector',
        caption:
          'Replace this slot with a screenshot showing the connector available in Claude web or mobile.',
      },
    ],
    testChecklist: [
      'Confirm that Codebase appears as connected in Settings > Connectors.',
      'Confirm that the connector appears during tool approval or in the search or tools UI while chatting.',
      'Confirm that a connector added on the web is also available on mobile.',
    ],
    troubleshooting: [
      'The remote MCP server must be publicly reachable. A VPN-only or intranet-only endpoint may fail to connect.',
      'Review any write-capable tool permissions carefully before approving them.',
      'If you need to change connection details, you may need to remove the existing connector and add it again.',
    ],
    sources: [
      {
        label: 'Get started with custom connectors using remote MCP',
        href: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
        description: 'Anthropic’s user-facing guide to custom connector setup, security, and approval UX.',
      },
      {
        label: 'Build custom connectors via remote MCP servers',
        href: 'https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers',
        description: 'Reference article for the current remote MCP connector support model and product context.',
      },
    ],
    lastVerified: '2026-04-17',
  },
];

export const APP_CONNECTION_DOCS_BY_SLUG = Object.fromEntries(
  APP_CONNECTION_DOCS.map((doc) => [doc.slug, doc]),
) as Record<AppConnectionDocSlug, AppConnectionDoc>;
