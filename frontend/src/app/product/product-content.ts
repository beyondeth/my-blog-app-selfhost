import type { AppLocale } from '@/lib/i18n/config';

const content = {
  en: {
    languageLabel: '한국어',
    eyebrow: 'A publishing workspace for durable knowledge',
    heroTitle: 'Keep the useful parts of every AI conversation.',
    heroDescription:
      'Codebase turns working notes into edited posts you can own, publish, and continue improving—without rebuilding the same workflow in every tool.',
    primaryCta: 'Start writing',
    secondaryCta: 'Read the docs',
    boardLabel: 'A working knowledge record',
    boardRecord: 'CODEBASE / RECORD 014',
    boardStatus: 'READY',
    boardFlow: 'Capture → review → publish → maintain',
    boardTitle: 'One source, ready for every destination.',
    boardItems: [
      ['01 / Capture', 'MCP-compatible workflow'],
      ['02 / Edit', 'Rich text and Markdown'],
      ['03 / Publish', 'Blog or community'],
      ['04 / Own', 'Self-hosted deployment'],
    ],
    principlesEyebrow: 'What it does',
    principlesTitle: 'A smaller loop between learning and publishing.',
    principlesDescription:
      'The product is designed around the work itself: capture a useful result, review it, attach the source files, and publish it where it belongs.',
    principles: [
      {
        number: '01',
        title: 'Capture through MCP',
        description:
          'Bring a useful AI result into a structured draft from an MCP-compatible client instead of copying fragments between tabs.',
      },
      {
        number: '02',
        title: 'Edit before it becomes permanent',
        description:
          'Review the title, body, images, thumbnail, tags, and publishing target in one deliberate editing step.',
      },
      {
        number: '03',
        title: 'Publish to the right audience',
        description:
          'Keep a post on your own blog or continue the discussion in a topic community without losing its source record.',
      },
    ],
    workflowEyebrow: 'The workflow',
    workflowTitle: 'From a useful answer to a maintained article.',
    workflowSteps: [
      ['Connect', 'Use the documented MCP connection flow with your compatible AI client.'],
      ['Review', 'Shape the generated draft, confirm media uploads, and choose its destination.'],
      ['Publish', 'Create a stable page that can be revisited, corrected, and shared.'],
    ],
    interfaceLabel: 'Editor checkpoint',
    interfaceTitle: 'Nothing publishes while media is unfinished.',
    interfaceItems: ['Body reviewed', 'Images uploaded', 'Thumbnail selected', 'Destination confirmed'],
    destinationsEyebrow: 'Built for more than a feed',
    destinationsTitle: 'Your writing stays useful after publication.',
    destinations: [
      {
        title: 'Personal blog',
        description: 'A stable archive with categories, tags, rich media, and a URL you control.',
        href: '/new-story',
        link: 'Create a story',
      },
      {
        title: 'Communities',
        description: 'Share the work with people who can question it, extend it, and put it into practice.',
        href: '/c',
        link: 'Browse communities',
      },
      {
        title: 'Documentation',
        description: 'Follow the actual connection and publishing flow without invented shortcuts or hidden steps.',
        href: '/docs',
        link: 'Open documentation',
      },
    ],
    selfHostEyebrow: 'Self-hosted edition / MIT release',
    selfHostTitle: 'Run it on your infrastructure. Make it fit your workflow.',
    selfHostDescription:
      'The self-hosted edition is being prepared for a public MIT-licensed release. After the repository visibility and license checks are complete, you will be free to use, modify, and redistribute it under the MIT License.',
    selfHostStatus: 'Public repository verification pending',
    selfHostPoints: ['Application source', 'Deployment configuration', 'Storage and database integration'],
    finalTitle: 'Turn today’s useful work into tomorrow’s reference.',
    finalDescription: 'Start with one draft. Keep the parts worth remembering.',
    finalCta: 'Create an account',
  },
  ko: {
    languageLabel: 'English',
    eyebrow: '오래 남는 지식을 위한 퍼블리싱 워크스페이스',
    heroTitle: 'AI 대화에서 쓸모 있는 부분만 지식으로 남기세요.',
    heroDescription:
      'Codebase는 작업 메모를 직접 소유하고 계속 다듬을 수 있는 글로 바꿉니다. 도구를 옮길 때마다 같은 퍼블리싱 과정을 다시 만들 필요가 없습니다.',
    primaryCta: '글쓰기 시작',
    secondaryCta: '문서 보기',
    boardLabel: '실제로 관리되는 지식 기록',
    boardRecord: 'CODEBASE / 기록 014',
    boardStatus: '준비 완료',
    boardFlow: '수집 → 검토 → 발행 → 관리',
    boardTitle: '하나의 원본을 필요한 곳에 발행합니다.',
    boardItems: [
      ['01 / 수집', 'MCP 호환 워크플로'],
      ['02 / 편집', '리치 텍스트와 Markdown'],
      ['03 / 발행', '블로그 또는 커뮤니티'],
      ['04 / 소유', '셀프호스트 배포'],
    ],
    principlesEyebrow: '핵심 기능',
    principlesTitle: '배운 것과 발행하는 것 사이의 거리를 줄입니다.',
    principlesDescription:
      '유용한 결과를 가져오고, 검토하고, 원본 파일을 연결한 뒤 알맞은 곳에 발행하는 실제 작업 흐름에 집중했습니다.',
    principles: [
      {
        number: '01',
        title: 'MCP로 수집',
        description:
          '여러 탭에서 내용을 복사하는 대신 MCP 호환 AI 클라이언트의 결과를 구조화된 초안으로 가져옵니다.',
      },
      {
        number: '02',
        title: '남기기 전에 편집',
        description:
          '제목, 본문, 이미지, 썸네일, 태그와 발행 대상을 한 번의 명확한 편집 단계에서 확인합니다.',
      },
      {
        number: '03',
        title: '알맞은 독자에게 발행',
        description:
          '개인 블로그에 보관하거나 주제 커뮤니티에서 토론을 이어가도 글의 원본 기록은 유지됩니다.',
      },
    ],
    workflowEyebrow: '작동 방식',
    workflowTitle: '유용한 답변을 관리되는 글로 바꾸는 과정.',
    workflowSteps: [
      ['연결', '문서에 안내된 절차로 MCP 호환 AI 클라이언트를 연결합니다.'],
      ['검토', '초안을 다듬고 미디어 업로드 완료 여부와 발행 대상을 확인합니다.'],
      ['발행', '다시 찾아보고 수정하고 공유할 수 있는 안정적인 페이지를 만듭니다.'],
    ],
    interfaceLabel: '편집기 체크포인트',
    interfaceTitle: '미디어가 덜 올라간 상태로 글을 발행하지 않습니다.',
    interfaceItems: ['본문 검토', '이미지 업로드', '썸네일 선택', '발행 대상 확인'],
    destinationsEyebrow: '피드보다 오래 쓰이는 글',
    destinationsTitle: '발행한 뒤에도 지식의 쓸모가 이어집니다.',
    destinations: [
      {
        title: '개인 블로그',
        description: '카테고리, 태그, 미디어와 직접 관리하는 URL을 갖춘 안정적인 아카이브입니다.',
        href: '/new-story',
        link: '새 글 작성',
      },
      {
        title: '커뮤니티',
        description: '질문하고 확장하고 실제로 적용할 사람들과 작업 결과를 나눕니다.',
        href: '/c',
        link: '커뮤니티 둘러보기',
      },
      {
        title: '문서',
        description: '꾸며낸 지름길이나 숨겨진 단계 없이 실제 연결과 발행 절차를 확인합니다.',
        href: '/docs',
        link: '문서 열기',
      },
    ],
    selfHostEyebrow: '셀프호스트 에디션 / MIT 공개 준비',
    selfHostTitle: '내 인프라에서 실행하고, 내 작업 방식에 맞게 바꾸세요.',
    selfHostDescription:
      '셀프호스트 에디션은 MIT 라이선스 공개를 준비하고 있습니다. 저장소 공개 상태와 라이선스 확인이 끝나면 MIT License 조건 아래 자유롭게 사용·수정·재배포할 수 있습니다.',
    selfHostStatus: '공개 저장소 및 라이선스 확인 대기 중',
    selfHostPoints: ['애플리케이션 소스', '배포 구성', '스토리지·데이터베이스 연동'],
    finalTitle: '오늘의 유용한 작업을 내일의 참고 자료로 만드세요.',
    finalDescription: '한 편의 초안부터 시작해 기억할 가치가 있는 내용을 남기세요.',
    finalCta: '계정 만들기',
  },
} as const;

export function getProductContent(locale: AppLocale) {
  return content[locale];
}
