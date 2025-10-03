'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiChevronDown, FiChevronUp, FiArrowLeft } from 'react-icons/fi';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const faqs: FAQItem[] = [
    // 계정 관련
    {
      category: '계정',
      question: '회원가입은 어떻게 하나요?',
      answer: '홈페이지 상단의 "회원가입" 버튼을 클릭하고 이메일, 사용자명, 비밀번호를 입력하면 가입이 완료됩니다. 이메일 인증을 완료하면 모든 기능을 사용할 수 있습니다.'
    },
    {
      category: '계정',
      question: '비밀번호를 잊어버렸어요.',
      answer: '로그인 페이지에서 "비밀번호 찾기"를 클릭하고 가입하신 이메일을 입력하세요. 비밀번호 재설정 링크를 이메일로 보내드립니다.'
    },
    {
      category: '계정',
      question: '계정을 삭제하고 싶어요.',
      answer: '설정 > 계정 > 계정 삭제에서 삭제할 수 있습니다. 계정 삭제 시 작성한 모든 글과 댓글이 영구적으로 삭제되며 복구할 수 없습니다.'
    },
    {
      category: '계정',
      question: '이메일 주소를 변경할 수 있나요?',
      answer: '설정 > 프로필에서 이메일 주소를 변경할 수 있습니다. 변경 후 새 이메일 주소로 인증을 완료해야 합니다.'
    },

    // 블로그 관련
    {
      category: '블로그',
      question: '블로그는 몇 개까지 만들 수 있나요?',
      answer: '현재 계정당 1개의 블로그만 생성할 수 있습니다. 향후 다중 블로그 기능을 지원할 예정입니다.'
    },
    {
      category: '블로그',
      question: '블로그 이름이나 URL을 변경할 수 있나요?',
      answer: '블로그 이름은 설정에서 변경 가능하지만, URL(slug)은 보안상의 이유로 변경할 수 없습니다. 신중하게 선택해주세요.'
    },
    {
      category: '블로그',
      question: '블로그를 비공개로 설정할 수 있나요?',
      answer: '현재는 모든 블로그가 공개 상태입니다. 향후 비공개 블로그 기능을 추가할 예정입니다.'
    },

    // 글쓰기 관련
    {
      category: '글쓰기',
      question: '어떤 형식으로 글을 작성할 수 있나요?',
      answer: '마크다운 형식을 지원합니다. 제목, 굵은 글씨, 기울임, 리스트, 링크, 이미지, 코드 블록 등 다양한 서식을 사용할 수 있습니다.'
    },
    {
      category: '글쓰기',
      question: '이미지는 어떻게 업로드하나요?',
      answer: '글쓰기 에디터에서 이미지 버튼을 클릭하거나 드래그 앤 드롭으로 업로드할 수 있습니다. 지원 형식: JPG, PNG, GIF (최대 10MB)'
    },
    {
      category: '글쓰기',
      question: '임시 저장 기능이 있나요?',
      answer: '글을 작성하면서 자동으로 임시 저장됩니다. 브라우저를 닫아도 다음에 이어서 작성할 수 있습니다.'
    },
    {
      category: '글쓰기',
      question: '글을 예약 발행할 수 있나요?',
      answer: '현재는 즉시 발행만 가능합니다. 예약 발행 기능은 개발 중입니다.'
    },

    // 댓글 관련
    {
      category: '댓글',
      question: '댓글을 차단할 수 있나요?',
      answer: '글 작성 시 댓글 허용 여부를 설정할 수 있습니다. 이미 작성된 글도 수정에서 댓글 설정을 변경할 수 있습니다.'
    },
    {
      category: '댓글',
      question: '스팸 댓글은 어떻게 관리하나요?',
      answer: '자동 스팸 필터링 시스템이 작동하며, 수동으로도 댓글을 삭제하거나 신고할 수 있습니다.'
    },

    // 결제 관련
    {
      category: '결제',
      question: '무료로 사용할 수 있나요?',
      answer: '네, 기본 기능은 모두 무료입니다. 프리미엄 기능을 원하시면 유료 플랜을 구독하실 수 있습니다.'
    },
    {
      category: '결제',
      question: '결제 방법은 어떤 것이 있나요?',
      answer: '신용카드, 체크카드, 카카오페이, 네이버페이를 지원합니다.'
    },
    {
      category: '결제',
      question: '환불은 가능한가요?',
      answer: '결제 후 7일 이내에 고객센터로 문의하시면 전액 환불이 가능합니다.'
    },

    // 기술 지원
    {
      category: '기술',
      question: '어떤 브라우저를 지원하나요?',
      answer: 'Chrome, Firefox, Safari, Edge의 최신 버전을 지원합니다. Internet Explorer는 지원하지 않습니다.'
    },
    {
      category: '기술',
      question: '모바일 앱이 있나요?',
      answer: '현재 웹 버전만 제공하고 있으며, 모바일 최적화된 반응형 웹을 제공합니다. 네이티브 앱은 개발 중입니다.'
    },
    {
      category: '기술',
      question: 'API를 제공하나요?',
      answer: '네, RESTful API를 제공합니다. 설정 > API 키에서 키를 발급받고 문서를 확인할 수 있습니다.'
    },
  ];

  const categories = Array.from(new Set(faqs.map(faq => faq.category)));

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/help-center"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            고객센터로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-foreground">자주 묻는 질문</h1>
          <p className="mt-2 text-muted-foreground">MyBlog 사용에 대한 자주 묻는 질문과 답변</p>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {categories.map((category) => (
          <div key={category} className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-6 pb-2 border-b border-border">
              {category}
            </h2>
            <div className="space-y-4">
              {faqs
                .filter(faq => faq.category === category)
                .map((faq, index) => {
                  const globalIndex = faqs.indexOf(faq);
                  const isOpen = openItems.has(globalIndex);

                  return (
                    <div
                      key={globalIndex}
                      className="border border-border rounded-lg overflow-hidden bg-card"
                    >
                      <button
                        onClick={() => toggleItem(globalIndex)}
                        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted transition-colors"
                      >
                        <span className="font-medium text-foreground">{faq.question}</span>
                        {isOpen ? (
                          <FiChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FiChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-4">
                          <p className="text-muted-foreground">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {/* Still have questions */}
        <div className="mt-16 p-8 bg-muted rounded-lg text-center">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            원하는 답변을 찾지 못하셨나요?
          </h3>
          <p className="text-muted-foreground mb-6">
            직접 문의해주시면 빠르게 답변 드리겠습니다.
          </p>
          <Link
            href="/help-center/contact"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-foreground bg-foreground hover:bg-foreground/90 transition-colors"
          >
            문의하기
          </Link>
        </div>
      </div>
    </div>
  );
}