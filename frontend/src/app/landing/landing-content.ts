import type { AppLocale } from '@/lib/i18n/config';

type LandingCopy = {
  languageLabel: string;
  navLabel: string;
  navItems: Array<{ href: string; label: string }>;
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    githubCta: string;
    liveCta: string;
    proof: string[];
    automationLabel: string;
    automationTitle: string;
    automationDescription: string;
    repositoryLabel: string;
    repositoryTitle: string;
    repositoryDescription: string;
    repositoryCta: string;
  };
  demo: {
    eyebrow: string;
    title: string;
    description: string;
    notice: string;
    editorPick: {
      label: string;
      title: string;
      description: string;
      meta: string;
    };
    cards: Array<{
      category: string;
      title: string;
      description: string;
      author: string;
      meta: string;
    }>;
    sidebarTitle: string;
    sidebarItems: string[];
    toolsTitle: string;
    toolsDescription: string;
  };
  foundations: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ title: string; description: string }>;
  };
  pipeline: {
    eyebrow: string;
    title: string;
    description: string;
    steps: Array<{ code: string; title: string; description: string }>;
    destinationTitle: string;
    destinationDescription: string;
  };
  branding: {
    eyebrow: string;
    title: string;
    description: string;
    previews: Array<{ label: string; title: string; handle: string; description: string }>;
    features: string[];
  };
  community: {
    eyebrow: string;
    title: string;
    description: string;
    capabilities: string[];
    discussionLabel: string;
    discussionTitle: string;
    discussionMeta: string;
  };
  openSource: {
    eyebrow: string;
    title: string;
    description: string;
    stack: string[];
    points: Array<{ title: string; description: string }>;
    notice: string;
    githubCta: string;
    docsCta: string;
  };
  final: {
    eyebrow: string;
    title: string;
    description: string;
    githubCta: string;
    exploreCta: string;
  };
};

const content = {
  ko: {
    languageLabel: 'English',
    navLabel: '랜딩 페이지 섹션',
    navItems: [
      { href: '#preview', label: '서비스 미리보기' },
      { href: '#foundation', label: '기능 기반' },
      { href: '#automation', label: '자동포스팅' },
      { href: '#blog-design', label: '블로그 디자인' },
      { href: '#community', label: '커뮤니티' },
      { href: '#open-source', label: '오픈소스' },
    ],
    hero: {
      eyebrow: 'MIT 오픈소스 퍼블리싱 스택',
      title: '블로그에서 자동화, 커뮤니티까지.',
      accent: '내 방식으로 운영하세요.',
      description:
        '탄탄한 CRUD와 편집·미디어·운영 기반 위에 MCP 자동포스팅을 연결하고, 브랜드에 맞게 커스터마이징해 개인 블로그·커뮤니티·상업용 포크로 확장할 수 있습니다.',
      githubCta: 'GitHub에서 시작하기',
      liveCta: '라이브 피드 보기',
      proof: ['MIT 라이선스', '내 인프라에 배포', 'MCP 자동포스팅', '블로그·커뮤니티 통합'],
      automationLabel: 'AUTOMATION PIPELINE',
      automationTitle: '대화에서 발행까지 한 흐름으로',
      automationDescription: '인증 확인, 글쓰기 스타일, 이미지 업로드와 발행을 5개의 MCP 도구로 연결합니다.',
      repositoryLabel: 'PUBLIC REPOSITORY',
      repositoryTitle: 'Aigory Self-host',
      repositoryDescription: '직접 실행하고, 수정하고, 자신의 제품으로 발전시킬 수 있는 공개 기반입니다.',
      repositoryCta: '저장소 열기',
    },
    demo: {
      eyebrow: '실제 제품 구조를 본뜬 데모',
      title: '읽고, 기록하고, 다시 연결되는 홈피드',
      description:
        '블로그 글과 커뮤니티 포스트가 하나의 피드에서 발견됩니다. 아래 콘텐츠는 안정적인 랜딩을 위한 검수된 예시입니다.',
      notice: 'DEMO CONTENT',
      editorPick: {
        label: 'EDITOR PICK',
        title: '자동화 과정도 내 지식으로 남기는 개발 블로그',
        description: 'AI와 함께 해결한 문제를 검토 가능한 글로 정리하고, 이미지와 출처를 연결해 다시 찾을 수 있게 만듭니다.',
        meta: '개발 · 자동포스팅 · 6분 읽기',
      },
      cards: [
        {
          category: '자동화',
          title: 'MCP로 정리한 이미지 업로드 파이프라인',
          description: '인증부터 WebP 업로드, 커버 연결까지 실제 발행 순서를 기록했습니다.',
          author: 'Bimmo',
          meta: '12분 전 · 댓글 8',
        },
        {
          category: '블로그 디자인',
          title: '내 브랜드 색상으로 완성한 개발 블로그',
          description: '커버, 로고, 아이콘과 브랜드 색상을 한곳에서 관리하는 방법입니다.',
          author: 'Jooli',
          meta: '28분 전 · 저장 31',
        },
        {
          category: '커뮤니티',
          title: '셀프호스트 운영 노트를 함께 개선하기',
          description: '역할, 댓글, 투표와 신고 도구로 관심사 중심의 공간을 운영합니다.',
          author: 'LumoPop',
          meta: '1시간 전 · 토론 14',
        },
      ],
      sidebarTitle: '처음부터 포함된 기반',
      sidebarItems: ['계정·OAuth·세션', '블로그·초안·에디터', '파일·이미지·스토리지', '피드·검색·알림', '커뮤니티·운영·관리'],
      toolsTitle: '자동포스팅 도구 5개',
      toolsDescription: 'API Key 또는 OAuth로 인증하고, 글쓰기 스타일과 이미지 발행 흐름을 재사용합니다.',
    },
    foundations: {
      eyebrow: 'CRUD에서 시작해 제품으로',
      title: '다시 만들기 비싼 기반은 이미 준비되어 있습니다.',
      description: '한 번 쓰는 데모가 아니라 실제 운영에 필요한 발행, 자동화, 브랜딩과 커뮤니티 흐름을 함께 제공합니다.',
      items: [
        { title: '발행', description: '개인 블로그, 초안, 리치 텍스트·Markdown, 카테고리, 태그, 미디어와 관련 글.' },
        { title: '자동화', description: '직접 MCP와 OAuth MCP, 글쓰기 스타일, 즉시 발행, 서명 이미지 업로드.' },
        { title: '커스터마이징', description: '이름, 커버, 로고, 아이콘, 브랜드 색상과 공개 URL을 자신의 정체성에 맞게 구성.' },
        { title: '커뮤니티', description: '멤버십, 역할, 글, 댓글, 투표, 신고, 위젯, 검색 노출과 평판 시스템.' },
      ],
    },
    pipeline: {
      eyebrow: 'MCP 자동포스팅',
      title: '한 번 연결하고, 확인한 뒤, 발행합니다.',
      description: '브라우저 화면의 성공 표시가 아니라 실제 인증과 도구 응답을 확인하는 공개 계약을 사용합니다.',
      steps: [
        { code: '01', title: 'AI 클라이언트 연결', description: 'Codex나 MCP 호환 클라이언트에서 직접 MCP 또는 OAuth MCP를 연결합니다.' },
        { code: '02', title: 'check_auth', description: '쓰기 전에 사용자와 블로그 접근 권한, 실제 인증 방식을 확인합니다.' },
        { code: '03', title: 'get_writing_style_guide', description: '튜토리얼, 리서치, 에세이 등 재사용 가능한 글쓰기 규칙을 불러옵니다.' },
        { code: '04', title: '이미지 업로드', description: '필요하면 서명 URL을 발급하고 WebP 업로드를 완료해 파일 ID를 확보합니다.' },
        { code: '05', title: 'create_post', description: '검토한 제목, 본문, 카테고리, 태그와 미디어를 블로그에 즉시 발행합니다.' },
      ],
      destinationTitle: '발행 후에도 계속 쓰이는 글',
      destinationDescription: '안정적인 블로그 URL로 보관하고, 홈피드에서 발견되며, 관련 커뮤니티에서 토론을 이어갈 수 있습니다.',
    },
    branding: {
      eyebrow: '블로그 디자인',
      title: '같은 기반 위에, 서로 다른 정체성을 만드세요.',
      description: '지원하지 않는 테마를 약속하지 않습니다. 현재 제공되는 커버·로고·아이콘·브랜드 색상과 배치 옵션을 보여줍니다.',
      previews: [
        { label: 'COVER FIRST', title: 'Build Notes', handle: '@build-notes', description: '제품을 만들며 배운 것과 선택의 이유를 기록합니다.' },
        { label: 'INLINE IDENTITY', title: 'Field Journal', handle: '@field-journal', description: '현장에서 수집한 관찰과 리서치를 오래 남깁니다.' },
        { label: 'BADGE IDENTITY', title: 'Studio Log', handle: '@studio-log', description: '작업 과정과 창작 노하우를 한곳에 모읍니다.' },
      ],
      features: ['커버 이미지', '블로그 로고', '아이콘·배지 배치', '브랜드 색상', '소개 문구·공개 주소'],
    },
    community: {
      eyebrow: '블로그에서 커뮤니티로',
      title: '글을 쌓는 데서 멈추지 않고, 함께 발전시킵니다.',
      description: '개인 아카이브로 시작해 주제별 공간을 만들고, 멤버와 운영자가 건강한 토론을 관리할 수 있습니다.',
      capabilities: ['멤버십과 역할', '글·댓글·대댓글', '투표와 평판', '신고와 운영 도구', '규칙과 위젯', '홈피드·검색 노출'],
      discussionLabel: 'OPEN SOURCE OPERATORS',
      discussionTitle: '셀프호스트 백업 전략을 어떻게 운영하고 있나요?',
      discussionMeta: '답변 14 · 참여자 9 · 운영 가이드 연결',
    },
    openSource: {
      eyebrow: 'OPEN SOURCE / MIT',
      title: '내 인프라에서 실행하고, 내 제품으로 발전시키세요.',
      description: '애플리케이션 코드, 배포 구성, 자동포스팅 스킬과 운영 문서를 공개합니다. 데이터와 브랜드, 배포 방식은 운영자가 직접 통제합니다.',
      stack: ['Next.js 16', 'NestJS 11', 'PostgreSQL 18', 'Valkey 8', 'MinIO / S3', 'MCP Proxy'],
      points: [
        { title: 'Self-host', description: 'Docker Compose 기반 설치 흐름과 진단·백업·운영 문서를 제공합니다.' },
        { title: 'Customize', description: '브랜드, 콘텐츠 흐름과 제품 표면을 자신의 사용자와 업무에 맞게 수정할 수 있습니다.' },
        { title: 'Productize', description: 'MIT 조건 아래 상업용 포크로 확장할 수 있으며 운영 책임과 정책도 직접 설계합니다.' },
      ],
      notice: '결제, 구독, checkout, 결제사 연동은 기본 제공 기능이 아닙니다. 상업용 포크에서 직접 구현할 수 있습니다.',
      githubCta: 'GitHub 저장소 보기',
      docsCta: 'Self-host 문서 보기',
    },
    final: {
      eyebrow: 'START WITH A SOLID FOUNDATION',
      title: '블로그 하나로 시작해, 자동화된 지식 플랫폼으로 확장하세요.',
      description: '코드를 직접 실행하고 구조를 확인한 뒤, 자신의 브랜드와 운영 방식에 맞게 바꿀 수 있습니다.',
      githubCta: 'Aigory Self-host 시작하기',
      exploreCta: '라이브 서비스 둘러보기',
    },
  },
  en: {
    languageLabel: '한국어',
    navLabel: 'Landing page sections',
    navItems: [
      { href: '#preview', label: 'Product preview' },
      { href: '#foundation', label: 'Foundation' },
      { href: '#automation', label: 'Auto-publishing' },
      { href: '#blog-design', label: 'Blog design' },
      { href: '#community', label: 'Community' },
      { href: '#open-source', label: 'Open source' },
    ],
    hero: {
      eyebrow: 'MIT-LICENSED PUBLISHING STACK',
      title: 'From a blog to automation and community.',
      accent: 'Run it your way.',
      description:
        'Start with solid CRUD, editing, media, and operations. Add MCP auto-publishing, shape the brand, and extend it into a personal blog, a community, or a commercial fork.',
      githubCta: 'Start on GitHub',
      liveCta: 'Explore the live feed',
      proof: ['MIT licensed', 'Deploy on your infrastructure', 'MCP auto-publishing', 'Blogs and communities'],
      automationLabel: 'AUTOMATION PIPELINE',
      automationTitle: 'One flow from conversation to publication',
      automationDescription: 'Connect authentication, writing styles, image uploads, and publishing through five MCP tools.',
      repositoryLabel: 'PUBLIC REPOSITORY',
      repositoryTitle: 'Aigory Self-host',
      repositoryDescription: 'A public foundation you can run, modify, and develop into a product of your own.',
      repositoryCta: 'Open repository',
    },
    demo: {
      eyebrow: 'A CURATED PRODUCT DEMO',
      title: 'A home feed where writing stays connected',
      description: 'Blog articles and community posts are discovered in one feed. The content below is a reviewed, static example for a reliable landing page.',
      notice: 'DEMO CONTENT',
      editorPick: {
        label: 'EDITOR PICK',
        title: 'A developer blog that keeps the automation process',
        description: 'Turn an AI-assisted solution into a reviewable article, connect its media and sources, and make it useful again later.',
        meta: 'Development · Auto-publishing · 6 min read',
      },
      cards: [
        {
          category: 'Automation',
          title: 'The MCP image-upload pipeline, documented',
          description: 'A practical record from authentication to WebP upload and cover attachment.',
          author: 'Bimmo',
          meta: '12 min ago · 8 replies',
        },
        {
          category: 'Blog design',
          title: 'A developer blog shaped with one brand color',
          description: 'Manage the cover, logo, icon, and primary color in one place.',
          author: 'Jooli',
          meta: '28 min ago · 31 saves',
        },
        {
          category: 'Community',
          title: 'Improving self-host operations together',
          description: 'Run an interest-based space with roles, replies, votes, and reporting tools.',
          author: 'LumoPop',
          meta: '1 hour ago · 14 replies',
        },
      ],
      sidebarTitle: 'Included from the start',
      sidebarItems: ['Accounts, OAuth, sessions', 'Blogs, drafts, editor', 'Files, images, storage', 'Feed, search, notifications', 'Community and moderation'],
      toolsTitle: 'Five auto-publishing tools',
      toolsDescription: 'Authenticate with an API key or OAuth, then reuse the writing-style and media publishing flow.',
    },
    foundations: {
      eyebrow: 'FROM CRUD TO A PRODUCT',
      title: 'The expensive foundation is already in place.',
      description: 'This is not a one-use demo. Publishing, automation, branding, and community operations belong to the same working system.',
      items: [
        { title: 'Publish', description: 'Personal blogs, drafts, rich text and Markdown, categories, tags, media, and related posts.' },
        { title: 'Automate', description: 'Direct MCP and OAuth MCP, writing styles, immediate publication, and signed image uploads.' },
        { title: 'Customize', description: 'Shape names, covers, logos, icons, brand colors, and public URLs around your identity.' },
        { title: 'Community', description: 'Memberships, roles, posts, replies, votes, reports, widgets, discovery, and reputation.' },
      ],
    },
    pipeline: {
      eyebrow: 'MCP AUTO-PUBLISHING',
      title: 'Connect once, verify, then publish.',
      description: 'The public contract verifies real authentication and tool responses instead of trusting a browser success screen.',
      steps: [
        { code: '01', title: 'Connect an AI client', description: 'Connect direct MCP or OAuth MCP from Codex or another compatible client.' },
        { code: '02', title: 'check_auth', description: 'Confirm the user, blog access, and actual authentication mode before any write.' },
        { code: '03', title: 'get_writing_style_guide', description: 'Load reusable rules for tutorials, research, essays, and other writing styles.' },
        { code: '04', title: 'Upload optional media', description: 'Request a signed URL, upload WebP bytes, and finalize the file ID.' },
        { code: '05', title: 'create_post', description: 'Publish the reviewed title, body, category, tags, and media to the blog.' },
      ],
      destinationTitle: 'Writing that stays useful after publication',
      destinationDescription: 'Keep a stable blog URL, appear in the home feed, and continue the conversation in a relevant community.',
    },
    branding: {
      eyebrow: 'BLOG DESIGN',
      title: 'One foundation, distinctly different identities.',
      description: 'No invented themes. These previews use the cover, logo, icon, brand color, and placement controls that exist today.',
      previews: [
        { label: 'COVER FIRST', title: 'Build Notes', handle: '@build-notes', description: 'Lessons learned and the reasoning behind product decisions.' },
        { label: 'INLINE IDENTITY', title: 'Field Journal', handle: '@field-journal', description: 'Observations and research collected in the field.' },
        { label: 'BADGE IDENTITY', title: 'Studio Log', handle: '@studio-log', description: 'Creative processes and practical studio knowledge.' },
      ],
      features: ['Cover image', 'Blog logo', 'Icon and badge placement', 'Brand color', 'Description and public URL'],
    },
    community: {
      eyebrow: 'FROM BLOG TO COMMUNITY',
      title: 'Do more than archive writing. Improve it together.',
      description: 'Start with a personal record, create topic spaces, and give members and moderators the tools for healthy discussion.',
      capabilities: ['Memberships and roles', 'Posts and threaded replies', 'Votes and reputation', 'Reports and moderation', 'Rules and widgets', 'Feed and search discovery'],
      discussionLabel: 'OPEN SOURCE OPERATORS',
      discussionTitle: 'How do you run backups for your self-hosted instance?',
      discussionMeta: '14 replies · 9 participants · Operations guide linked',
    },
    openSource: {
      eyebrow: 'OPEN SOURCE / MIT',
      title: 'Run it on your infrastructure. Develop it into your product.',
      description: 'The application code, deployment configuration, auto-publishing skill, and operations documentation are public. You control the data, brand, and deployment model.',
      stack: ['Next.js 16', 'NestJS 11', 'PostgreSQL 18', 'Valkey 8', 'MinIO / S3', 'MCP Proxy'],
      points: [
        { title: 'Self-host', description: 'Use the Docker Compose setup flow with diagnostics, backup guidance, and operations documentation.' },
        { title: 'Customize', description: 'Adapt the brand, content workflow, and product surface to your users and operating model.' },
        { title: 'Productize', description: 'Build a commercial fork under the MIT terms and define the operating policies it needs.' },
      ],
      notice: 'Payments, subscriptions, checkout, and payment-provider integrations are not included features. A commercial fork may implement them.',
      githubCta: 'View the GitHub repository',
      docsCta: 'Read the self-host guide',
    },
    final: {
      eyebrow: 'START WITH A SOLID FOUNDATION',
      title: 'Begin with one blog. Grow into an automated knowledge platform.',
      description: 'Run the code, inspect the architecture, then adapt it to your brand and operating model.',
      githubCta: 'Start with Aigory Self-host',
      exploreCta: 'Explore the live service',
    },
  },
} satisfies Record<AppLocale, LandingCopy>;

export function getLandingContent(locale: AppLocale): LandingCopy {
  return content[locale];
}
