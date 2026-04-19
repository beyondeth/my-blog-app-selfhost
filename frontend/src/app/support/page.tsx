'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { useLocaleContext } from '@/providers/LocaleProvider';
import type { AppLocale } from '@/lib/i18n/config';
import {
  ChevronDown,
  ArrowRight,
} from 'lucide-react';

type SupportAction = {
  title: string;
  description: string;
  cta: string;
  href?: string;
  kind: 'link' | 'button';
};

type FaqItem = {
  question: string;
  answer: string;
  href?: string;
  hrefLabel?: string;
};

const SUPPORT_ROW_TITLE_CLASS =
  'text-[15px] font-medium leading-6 tracking-[-0.01em] text-[#202124] dark:text-white';

const SUPPORT_ROW_DESCRIPTION_CLASS =
  'mt-1 max-w-[58ch] text-[14px] leading-7 text-[#5f6368] dark:text-[#9aa0a6]';

const SUPPORT_ACTION_CARD_CLASS =
  'block w-full overflow-hidden rounded-2xl border border-[#e8eaed] bg-white px-7 py-6 text-left no-underline transition-colors hover:bg-[#f8f9fa] dark:border-[#303134] dark:bg-[#202124] dark:hover:bg-[#262a2d] sm:px-8';

const SUPPORT_CONTENT: Record<
  AppLocale,
  {
    title: string;
    description: string;
    eyebrow: string;
    toc: { id: string; label: string }[];
    contactHeading: string;
    contactBody: string;
    faqHeading: string;
    faqBody: string;
    actions: SupportAction[];
    faqs: FaqItem[];
  }
> = {
  ko: {
    title: '지원 및 자료',
    description:
      '문서에서 해결되지 않는 문제를 지원 흐름으로 바로 연결할 수 있도록 정리한 페이지입니다. 설정, 문제 재현, 운영 정책 확인까지 docs와 같은 리듬으로 이어집니다.',
    eyebrow: '지원',
    toc: [
      { id: 'contact', label: '문의 및 지원' },
      { id: 'faq', label: '자주 묻는 질문' },
    ],
    contactHeading: '문의 및 지원',
    contactBody:
      '우선 문서를 통해 설정과 연결 방식을 다시 확인하고, 여전히 해결되지 않으면 피드백 채널로 바로 전달하는 흐름을 권장합니다. support는 docs의 연장선으로 동작해야 하므로, 필요한 액션만 짧고 명확하게 배치했습니다.',
    faqHeading: '자주 묻는 질문',
    faqBody:
      '자주 반복되는 질문은 따로 모아 간단하게 답변했습니다. 더 긴 설명이 필요한 항목은 문서로 바로 이동할 수 있게 연결해 두었습니다.',
    actions: [
      {
        title: '피드백 보내기',
        description: '버그 리포트, 기능 제안, 계정 이슈를 가장 빠르게 전달하는 기본 지원 채널입니다.',
        cta: '피드백 열기',
        kind: 'button',
      },
      {
        title: 'MCP 문서 열기',
        description: 'API key 발급, MCP 연결 방식, 클라이언트별 설정 흐름을 문서 기준으로 다시 확인합니다.',
        cta: '문서 열기',
        href: '/docs/mcp',
        kind: 'link',
      },
    ],
    faqs: [
      {
        question: '자동 포스팅 시 MCP를 어떻게 연결해야 하나요?',
        answer:
          '설정 > API Keys에서 key를 발급한 뒤, 사용하는 클라이언트에 Codebase hosted MCP endpoint를 등록하면 됩니다. 정확한 스니펫은 문서와 설정 화면을 기준으로 확인하는 편이 가장 안전합니다.',
        href: '/docs/mcp',
        hrefLabel: 'API Keys & MCP 문서 보기',
      },
      {
        question: 'MCP 사용은 무료인가요?',
        answer:
          'Codebase의 MCP를 사용한 자동 포스팅은 무료로 시작할 수 있습니다. 다만 무료 계정은 시간당 30개, 하루 50회 제한이 적용되며, 월간 발행량은 플랜에 따라 달라집니다.',
      },
      {
        question: '계정을 삭제하려면 어떻게 해야 하나요?',
        answer:
          '설정 메뉴에서 계정 삭제를 진행할 수 있습니다. 삭제가 완료되면 관련 데이터는 복구할 수 없으므로, 필요한 정보는 미리 정리한 뒤 진행하는 것을 권장합니다.',
      },
      {
        question: '블로그 주소를 변경할 수 있나요?',
        answer:
          '가능합니다. 블로그 설정에서 블로그 주소를 변경할 수 있으며, 변경 이후에는 새 주소 기준으로 공개 링크와 접근 경로를 다시 확인하는 편이 안전합니다.',
      },
      {
        question: '문서에 없는 문제를 겪고 있으면 무엇을 같이 보내야 하나요?',
        answer:
          '사용 중인 클라이언트명, 현재 설정 화면, 문제가 재현되는 순간의 스크린샷을 함께 전달하면 원인 파악이 빨라집니다. 가능하면 어떤 단계에서 막혔는지도 같이 남겨 주세요.',
      },
    ],
  },
  en: {
    title: 'Support & Resources',
    description:
      'This page connects unresolved documentation issues to the support flow with the same structure and pacing as the docs.',
    eyebrow: 'Support',
    toc: [
      { id: 'contact', label: 'Contact & support' },
      { id: 'faq', label: 'Frequently asked questions' },
    ],
    contactHeading: 'Contact & support',
    contactBody:
      'Start by checking the setup docs again, then move into the support flow if the issue remains unresolved. The page is intentionally short so the next action is always obvious.',
    faqHeading: 'Frequently asked questions',
    faqBody:
      'Repeated questions are collected here with short answers. Where more detail is needed, the relevant documentation is linked directly.',
    actions: [
      {
        title: 'Send feedback',
        description: 'Report bugs, request features, or send account issues through the main support channel.',
        cta: 'Open feedback',
        kind: 'button',
      },
      {
        title: 'Open MCP docs',
        description: 'Review API key issuance, MCP connection steps, and client setup flows in the docs.',
        cta: 'Open docs',
        href: '/docs/mcp',
        kind: 'link',
      },
    ],
    faqs: [
      {
        question: 'How do I connect MCP for automated publishing?',
        answer:
          'Issue an API key from Settings > API Keys, then register the hosted Codebase MCP endpoint in your client. The docs contain the safest setup snippets and client-specific notes.',
        href: '/docs/mcp',
        hrefLabel: 'Open the API Keys & MCP guide',
      },
      {
        question: 'Is MCP usage free?',
        answer:
          'Automated publishing through Codebase MCP starts as part of the free beta. Rate limits still apply, and some publishing volume limits depend on future plan configuration.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'You can use the account deletion flow in settings. Before deleting, make sure you have exported or reviewed any content you want to keep.',
      },
      {
        question: 'Can I change my blog address?',
        answer:
          'Yes. You can update the blog address in blog settings and should verify public links after the change is applied.',
      },
      {
        question: 'What should I include when reporting an issue?',
        answer:
          'Include the client name, the current setup screen, and a screenshot or clear reproduction step. That usually shortens support turnaround significantly.',
      },
    ],
  },
};

function SupportActionCard({
  action,
  onAction,
}: {
  action: SupportAction;
  onAction: (action: SupportAction) => void;
}) {
  const content = (
    <div className="flex min-h-[156px] flex-col items-start">
      <div className="min-w-0">
        <h3 className={SUPPORT_ROW_TITLE_CLASS}>{action.title}</h3>
        <p className={SUPPORT_ROW_DESCRIPTION_CLASS}>{action.description}</p>
      </div>
      <span className="mt-auto inline-flex items-center whitespace-nowrap pt-5 text-[13px] font-medium leading-6 text-[#1a73e8] transition-colors dark:text-[#8ab4f8]">
        {action.cta}
      </span>
    </div>
  );

  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      className={`${SUPPORT_ACTION_CARD_CLASS} m-0 cursor-pointer appearance-none`}
    >
      {content}
    </button>
  );
}

function SupportFaqItem({ item }: { item: FaqItem }) {
  return (
    <details className="group border-b border-[#f1f3f4] last:border-b-0 dark:border-[#303134]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-6 px-7 py-6 [&::-webkit-details-marker]:hidden sm:px-8">
        <span className="text-[15px] font-medium leading-7 text-[#202124] dark:text-white">
          {item.question}
        </span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f8f9fa] text-[#5f6368] transition-transform duration-200 group-open:rotate-180 dark:bg-[#262a2d] dark:text-[#9aa0a6]">
          <ChevronDown className="h-4 w-4" />
        </span>
      </summary>
      <div className="px-7 pb-6 pt-0 text-[14px] leading-7 text-[#5f6368] dark:text-[#9aa0a6] sm:px-8">
        <p>{item.answer}</p>
        {item.href && item.hrefLabel ? (
          <Link
            href={item.href}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
          >
            {item.hrefLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </details>
  );
}

export default function SupportPage() {
  const router = useRouter();
  const { openModal } = useFeedbackStore();
  const { href } = useLocaleContext();
  const content = SUPPORT_CONTENT.en;

  const handleSupportAction = (action: SupportAction) => {
    if (action.kind === 'button') {
      openModal();
      return;
    }

    if (!action.href) {
      return;
    }

    router.push(href(action.href));
  };

  return (
    <DocsPageLayout
      currentPath="/support"
      title={content.title}
      description={content.description}
      toc={content.toc}
      eyebrow={content.eyebrow}
    >
      <section id="contact">
        <h2>{content.contactHeading}</h2>
        <p>{content.contactBody}</p>

        <div className="not-prose mt-8 grid gap-4">
          {content.actions.map((action) => (
            <SupportActionCard
              key={action.title}
              action={action}
              onAction={handleSupportAction}
            />
          ))}
        </div>
      </section>

      <section id="faq">
        <h2>{content.faqHeading}</h2>
        <p>{content.faqBody}</p>

        <div className="not-prose mt-8 overflow-hidden rounded-2xl border border-[#e8eaed] bg-white dark:border-[#303134] dark:bg-[#202124]">
          {content.faqs.map((item) => (
            <SupportFaqItem key={item.question} item={item} />
          ))}
        </div>
      </section>
    </DocsPageLayout>
  );
}
