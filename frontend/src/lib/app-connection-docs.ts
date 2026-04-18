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
      'OpenAI 공식 앱 문서를 기준으로 ChatGPT 안에서 Codebase app 흐름을 찾고 연결하는 단계형 가이드입니다.',
    status: 'official-docs',
    statusLabel: 'Official docs confirmed',
    statusDescription:
      'OpenAI는 기존 connectors 명칭을 apps로 통합했습니다. 사용자 문서는 ChatGPT Settings > Apps와 app directory를 기준으로 안내합니다.',
    prerequisites: [
      'Codebase에서 연결 대상이 준비되어 있어야 합니다.',
      'ChatGPT에 로그인되어 있어야 하며, 현재 플랜/워크스페이스에서 Apps가 노출되어야 합니다.',
      '워크스페이스 플랜에서는 관리자 설정 때문에 custom apps 사용 가능 여부가 달라질 수 있습니다.',
    ],
    steps: [
      {
        title: 'ChatGPT에서 Apps 진입점을 엽니다',
        description:
          'OpenAI 공식 도움말 기준으로 Settings > Apps 또는 app directory에서 시작합니다. 실제 UI 라벨은 plan과 workspace 설정에 따라 조금 다를 수 있습니다.',
        imageSrc: '/docs/apps/chatgpt/01-entry.png',
        imageAlt: 'ChatGPT Settings > Apps 진입 스크린샷',
        caption:
          'ChatGPT 안에서 Apps 진입 위치를 캡처해 이 파일에 넣으면 됩니다.',
      },
      {
        title: 'Codebase app 또는 custom app 연결 흐름을 찾습니다',
        description:
          'Apps directory에서 Codebase를 직접 찾거나, custom app 흐름이 열려 있다면 해당 엔트리에서 연결을 시작합니다.',
        imageSrc: '/docs/apps/chatgpt/02-open-connect.png',
        imageAlt: 'ChatGPT app directory 또는 custom app 연결 스크린샷',
        caption:
          '연결 버튼 또는 custom app 추가 화면을 캡처하는 슬롯입니다.',
      },
      {
        title: '로그인과 권한 부여를 완료합니다',
        description:
          '연결 도중 OpenAI 또는 Codebase 측 로그인/권한 확인이 나타나면 승인합니다. 처음 연결할 때 데이터 공유 및 사용 권한 설명을 꼭 확인합니다.',
        imageSrc: '/docs/apps/chatgpt/03-auth.png',
        imageAlt: 'ChatGPT app authorization 스크린샷',
        caption:
          '권한 부여나 로그인 화면을 캡처해 넣는 슬롯입니다.',
      },
      {
        title: '채팅에서 앱이 실제로 호출되는지 확인합니다',
        description:
          'OpenAI 도움말 기준으로 앱은 @ mention 또는 채팅 입력창의 + 메뉴에서 사용할 수 있습니다. 연결 후 Codebase를 대화에 불러 테스트합니다.',
        imageSrc: '/docs/apps/chatgpt/04-complete.png',
        imageAlt: 'ChatGPT 대화에서 Codebase app이 보이는 스크린샷',
        caption:
          '연결 완료 후 채팅에서 호출 가능한 상태를 보여주는 슬롯입니다.',
      },
    ],
    testChecklist: [
      'Settings > Apps에서 Codebase가 연결됨 상태로 보이는지 확인합니다.',
      '@ mention 또는 + 메뉴에서 Codebase가 선택 가능한지 확인합니다.',
      '짧은 테스트 프롬프트로 앱이 응답하는지 확인합니다.',
    ],
    troubleshooting: [
      'Apps가 보이지 않으면 현재 플랜, 지역, workspace 정책 제한을 먼저 확인합니다.',
      'custom app이 보이지 않으면 workspace admin이 Drafts/custom apps를 허용했는지 확인합니다.',
      '권한 부여 후 호출이 안 되면 연결을 끊고 다시 연결한 뒤 채팅을 새로 엽니다.',
    ],
    sources: [
      {
        label: 'Apps in ChatGPT',
        href: 'https://help.openai.com/en/articles/11487775-apps-in-chatgpt',
        description: '사용자 측 앱 연결, Settings > Apps, app directory, @ mention 흐름',
      },
      {
        label: 'Introducing apps in ChatGPT',
        href: 'https://openai.com/index/introducing-apps-in-chatgpt/',
        description: 'OpenAI의 apps/platform 명칭과 Apps SDK 배경 설명',
      },
    ],
    lastVerified: '2026-04-17',
  },
  {
    slug: 'perplexity',
    title: 'Perplexity Web / App Verification',
    shortTitle: 'Perplexity',
    summary:
      'Perplexity 공식 문서에서 Codebase 같은 외부 remote MCP 서버를 Perplexity 웹/앱에 연결하는 사용자 플로우는 아직 확인되지 않았습니다. 이 문서는 지원 여부를 검증하는 체크리스트입니다.',
    status: 'manual-verify',
    statusLabel: 'Manual verification required',
    statusDescription:
      '현재 공식적으로 확인된 Perplexity 문서는 Perplexity가 제공하는 MCP 서버를 다른 MCP 클라이언트에 연결하는 가이드입니다. Perplexity 웹/앱이 외부 remote MCP를 붙이는 사용자용 UI를 제공하는지는 별도 검증이 필요합니다.',
    prerequisites: [
      'Perplexity 계정과 현재 사용 중인 product surface가 있어야 합니다.',
      '해당 surface에서 외부 도구/앱/통합/MCP를 추가할 수 있는지 먼저 확인해야 합니다.',
      '지원 여부가 확정되기 전에는 이 문서를 일반 사용자용 공식 연결 가이드처럼 배포하지 않습니다.',
    ],
    steps: [
      {
        title: 'Perplexity 제품 UI에서 외부 연결 진입점을 찾습니다',
        description:
          'Settings, Integrations, Apps, Tools, MCP와 비슷한 메뉴가 실제로 존재하는지 확인합니다. 이 단계에서 해당 메뉴가 없다면 현재 surface는 외부 remote MCP 연결을 지원하지 않는 것으로 기록합니다.',
        imageSrc: '/docs/apps/perplexity/01-entry.png',
        imageAlt: 'Perplexity 설정 또는 통합 진입점 검증 스크린샷',
        caption:
          'Perplexity에서 외부 연결 관련 메뉴가 실제로 보이는지 캡처하는 슬롯입니다.',
        note:
          '이 단계는 공식 지원 여부를 검증하는 단계입니다. 메뉴가 없다면 이후 단계는 진행하지 않습니다.',
      },
      {
        title: '외부 remote MCP 또는 custom integration 항목을 찾습니다',
        description:
          '외부 서버 URL이나 custom integration을 입력할 수 있는지 확인합니다. Perplexity 공식 MCP 문서는 반대 방향, 즉 Perplexity MCP 서버를 다른 클라이언트에 붙이는 가이드이므로 여기서 직접 UI 검증이 필요합니다.',
        imageSrc: '/docs/apps/perplexity/02-open-connect.png',
        imageAlt: 'Perplexity 외부 MCP 연결 항목 검증 스크린샷',
        caption:
          '외부 MCP/custom integration 입력 폼이 있을 때 교체할 슬롯입니다.',
        note:
          '해당 입력 폼이 없다면 이 문서는 지원 불가 상태로 유지합니다.',
      },
      {
        title: '지원이 확인된 경우에만 연결 완료 화면을 캡처합니다',
        description:
          '실제 연결 UI가 존재하고 Codebase remote MCP를 붙일 수 있을 때만 연결 완료 상태, 호출 방식, 테스트 프롬프트를 추가 문서화합니다.',
        imageSrc: '/docs/apps/perplexity/03-complete.png',
        imageAlt: 'Perplexity 연결 완료 상태 검증 스크린샷',
        caption:
          '지원이 확인된 뒤 연결 완료 화면으로 교체할 슬롯입니다.',
        note:
          '연결 완료 화면이 확보되기 전까지는 placeholder를 유지하고 문서 상태를 수동 검증 필요로 둡니다.',
      },
    ],
    testChecklist: [
      'Perplexity UI에 외부 연결 또는 custom integration 진입점이 실제로 존재하는지 기록합니다.',
      '외부 remote MCP URL을 입력할 수 있는지 여부를 기록합니다.',
      '없다면 unsupported, 있다면 beta/preview 여부와 plan 조건을 같이 기록합니다.',
    ],
    troubleshooting: [
      'Perplexity 공식 문서가 다른 방향의 MCP 가이드인지 먼저 구분합니다.',
      '실제 제품 UI에 연결 메뉴가 없으면 지원한다고 단정하지 않습니다.',
      '지원이 확인되기 전까지는 docs 링크를 안내용 검증 문서로만 사용합니다.',
    ],
    sources: [
      {
        label: 'Perplexity MCP Server',
        href: 'https://docs.perplexity.ai/docs/getting-started/integrations/mcp-server',
        description:
          'Perplexity가 제공하는 MCP 서버를 Cursor, VS Code, Claude Code 등 다른 클라이언트에 연결하는 공식 문서',
      },
    ],
    lastVerified: '2026-04-17',
  },
  {
    slug: 'claude',
    title: 'Claude Web / Mobile Connection',
    shortTitle: 'Claude',
    summary:
      'Claude 공식 도움말을 기준으로 claude.ai에서 custom connector using remote MCP를 추가하고, 이후 웹과 모바일에서 사용하는 흐름을 정리한 가이드입니다.',
    status: 'official-docs',
    statusLabel: 'Official docs confirmed',
    statusDescription:
      'Claude는 custom connectors using remote MCP를 공식 지원합니다. 웹에서 추가한 remote connector는 Claude Mobile에서 사용할 수 있지만, 모바일에서 새 서버를 직접 추가하지는 못할 수 있습니다.',
    prerequisites: [
      'Codebase remote MCP endpoint가 public internet에서 접근 가능해야 합니다.',
      'Claude 계정과 현재 plan에서 custom connector가 노출되어야 합니다.',
      '보안상 신뢰할 수 있는 remote MCP 서버만 연결해야 합니다.',
    ],
    steps: [
      {
        title: 'Claude에서 Connectors 설정을 엽니다',
        description:
          'Claude 도움말 기준으로 claude.ai의 Settings > Connectors에서 시작합니다. 이미 연결된 connector가 있다면 목록 아래의 custom integration 진입점을 찾습니다.',
        imageSrc: '/docs/apps/claude/01-entry.png',
        imageAlt: 'Claude Settings > Connectors 진입 스크린샷',
        caption:
          'Claude web에서 Connectors 진입 위치를 교체할 슬롯입니다.',
      },
      {
        title: 'Add custom integration 또는 remote MCP 추가 흐름을 시작합니다',
        description:
          'Codebase remote MCP 서버 정보를 입력하는 단계입니다. 실제 라벨은 Add custom integration, custom connector, remote MCP와 비슷할 수 있습니다.',
        imageSrc: '/docs/apps/claude/02-open-connect.png',
        imageAlt: 'Claude custom connector 추가 스크린샷',
        caption:
          'remote MCP/custom integration 입력 화면으로 교체할 슬롯입니다.',
      },
      {
        title: 'OAuth 및 권한 부여를 완료합니다',
        description:
          'Claude 도움말 기준으로 custom connector는 일반적으로 OAuth 인증을 거칩니다. 권한 요청 범위를 검토하고 꼭 필요한 scope만 허용합니다.',
        imageSrc: '/docs/apps/claude/03-auth.png',
        imageAlt: 'Claude custom connector OAuth authorization 스크린샷',
        caption:
          'Claude와 Codebase 사이의 인증/권한 승인 화면을 교체할 슬롯입니다.',
      },
      {
        title: '웹에서 호출을 테스트하고 모바일 사용 가능 여부를 확인합니다',
        description:
          '연결 후 Claude 대화에서 connector가 호출되는지 확인합니다. Claude 도움말에 따르면 이미 추가된 remote server는 모바일에서 사용할 수 있지만, 새 서버 추가는 웹에서 진행하는 것이 안전합니다.',
        imageSrc: '/docs/apps/claude/04-complete.png',
        imageAlt: 'Claude 대화에서 connector가 연결된 상태 스크린샷',
        caption:
          'Claude web 또는 mobile에서 실제로 connector를 사용할 수 있는 상태를 보여주는 슬롯입니다.',
      },
    ],
    testChecklist: [
      'Settings > Connectors에서 Codebase가 연결된 상태로 보이는지 확인합니다.',
      '대화 중 tool approval 또는 search/tools 메뉴에서 connector가 표시되는지 확인합니다.',
      '웹에서 추가한 connector가 모바일에서도 사용 가능한지 확인합니다.',
    ],
    troubleshooting: [
      'remote MCP 서버는 public internet에서 접근 가능해야 하며 VPN/사내망 뒤에 있으면 연결되지 않을 수 있습니다.',
      '도구 승인 시 write action 범위를 신중히 검토합니다.',
      '설정을 바꿔야 하면 기존 connector를 제거한 뒤 다시 추가하는 방식이 필요할 수 있습니다.',
    ],
    sources: [
      {
        label: 'Get started with custom connectors using remote MCP',
        href: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
        description: 'Claude 사용자 측 custom connector 연결, 보안, 승인 UX',
      },
      {
        label: 'Build custom connectors via remote MCP servers',
        href: 'https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers',
        description: '현재 building guide 위치 변경 및 지원 문맥 확인',
      },
    ],
    lastVerified: '2026-04-17',
  },
];

export const APP_CONNECTION_DOCS_BY_SLUG = Object.fromEntries(
  APP_CONNECTION_DOCS.map((doc) => [doc.slug, doc]),
) as Record<AppConnectionDocSlug, AppConnectionDoc>;
