'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FiArrowLeft,
  FiBookOpen, 
  FiUsers, 
  FiShield, 
  FiFileText,
  FiCreditCard,
  FiTool,
  FiChevronRight,
  FiChevronDown,
  FiSearch,
  FiHome
} from 'react-icons/fi';

interface Article {
  id: string;
  title: string;
  category: string;
  content: React.ReactNode;
}

interface Category {
  id: string;
  title: string;
  icon: React.ReactNode;
  articles: Article[];
}

export default function HelpDocsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedArticle, setSelectedArticle] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // All help content in one place
  const categories: Category[] = [
    {
      id: 'getting-started',
      title: '시작하기',
      icon: <FiBookOpen className="w-4 h-4" />,
      articles: [
        {
          id: 'create-blog',
          title: '블로그 만들기',
          category: 'getting-started',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">블로그 만들기</h1>
              <p className="text-lg text-muted-foreground">
                MyBlog에서 나만의 블로그를 만들고 이야기를 시작하세요
              </p>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">개요</h2>
                <p className="text-muted-foreground">
                  MyBlog에서 블로그를 만드는 것은 매우 간단합니다. 몇 번의 클릭만으로
                  당신만의 블로그를 시작할 수 있으며, 바로 글을 작성하고 공유할 수 있습니다.
                </p>
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    <strong>알아두세요:</strong> 현재 계정당 하나의 블로그만 생성할 수 있습니다.
                    블로그 URL은 생성 후 변경할 수 없으니 신중하게 선택해주세요.
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">단계별 가이드</h2>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center font-semibold">
                      1
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-foreground">로그인하기</h3>
                      <p className="text-muted-foreground mt-1">
                        MyBlog 계정으로 로그인합니다. 계정이 없다면 먼저 회원가입을 진행하세요.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center font-semibold">
                      2
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-foreground">블로그 생성 페이지로 이동</h3>
                      <p className="text-muted-foreground mt-1">
                        상단 메뉴에서 "블로그 만들기" 버튼을 클릭하거나 프로필 메뉴에서 접근합니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center font-semibold">
                      3
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-foreground">블로그 정보 입력</h3>
                      <p className="text-muted-foreground mt-1">블로그 이름, URL, 설명을 입력합니다.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center font-semibold">
                      4
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-foreground">블로그 생성 완료</h3>
                      <p className="text-muted-foreground mt-1">
                        "블로그 만들기" 버튼을 클릭하면 블로그가 생성되고 자동으로 블로그 홈으로 이동합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )
        },
        {
          id: 'first-post',
          title: '첫 글 작성하기',
          category: 'getting-started',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">첫 글 작성하기</h1>
              <p className="text-lg text-muted-foreground">
                블로그를 만들었다면 이제 첫 번째 글을 작성해보세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">글쓰기 시작하기</h2>
                <p className="text-muted-foreground">
                  프로필 메뉴에서 "글쓰기" 버튼을 클릭하면 글 작성 페이지로 이동합니다.
                  마크다운 형식을 지원하므로 다양한 서식을 사용할 수 있습니다.
                </p>
                
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-2">필수 입력 항목</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• 제목: 글의 제목을 입력합니다</li>
                    <li>• 내용: 마크다운 형식으로 본문을 작성합니다</li>
                    <li>• 태그: 글의 주제를 나타내는 태그를 추가합니다 (선택)</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">발행하기</h2>
                <p className="text-muted-foreground">
                  글 작성이 완료되면 "발행" 버튼을 클릭하여 글을 공개합니다.
                  임시 저장 기능을 사용하면 나중에 이어서 작성할 수 있습니다.
                </p>
              </section>
            </div>
          )
        },
        {
          id: 'profile-setup',
          title: '프로필 설정하기',
          category: 'getting-started',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">프로필 설정하기</h1>
              <p className="text-lg text-muted-foreground">
                프로필 사진과 자기소개를 추가하여 블로그를 개인화하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">프로필 정보 수정</h2>
                <p className="text-muted-foreground">
                  설정 메뉴에서 프로필을 클릭하면 다음 정보를 수정할 수 있습니다:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>프로필 사진 업로드</li>
                  <li>사용자명 변경</li>
                  <li>자기소개 작성</li>
                  <li>소셜 미디어 링크 추가</li>
                </ul>
              </section>
            </div>
          )
        },
        {
          id: 'customize',
          title: '블로그 커스터마이징',
          category: 'getting-started',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">블로그 커스터마이징</h1>
              <p className="text-lg text-muted-foreground">
                블로그의 디자인과 설정을 변경하여 나만의 스타일을 만드세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">사용 가능한 설정</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>블로그 이름 변경</li>
                  <li>블로그 설명 수정</li>
                  <li>댓글 허용 여부 설정</li>
                  <li>공개/비공개 설정</li>
                </ul>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'policies',
      title: '정책 및 약관',
      icon: <FiShield className="w-4 h-4" />,
      articles: [
        {
          id: 'terms',
          title: '이용약관',
          category: 'policies',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">이용약관</h1>
              <p className="text-lg text-muted-foreground">
                MyBlog 서비스 이용에 관한 약관입니다
              </p>
              <p className="text-muted-foreground">
                자세한 이용약관은 <Link href="/terms" className="text-foreground hover:underline">여기</Link>에서 확인하실 수 있습니다.
              </p>
            </div>
          )
        },
        {
          id: 'privacy',
          title: '개인정보처리방침',
          category: 'policies',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">개인정보처리방침</h1>
              <p className="text-lg text-muted-foreground">
                개인정보 수집 및 이용에 관한 정책입니다
              </p>
              <p className="text-muted-foreground">
                자세한 개인정보처리방침은 <Link href="/privacy" className="text-foreground hover:underline">여기</Link>에서 확인하실 수 있습니다.
              </p>
            </div>
          )
        },
        {
          id: 'copyright',
          title: '저작권 정책',
          category: 'policies',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">저작권 정책</h1>
              <p className="text-lg text-muted-foreground">
                콘텐츠 저작권에 관한 정책입니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">콘텐츠 소유권</h2>
                <p className="text-muted-foreground">
                  사용자가 작성한 모든 콘텐츠의 저작권은 작성자에게 있습니다.
                  MyBlog는 서비스 제공을 위한 제한적인 사용권만을 가집니다.
                </p>
              </section>
            </div>
          )
        },
        {
          id: 'guidelines',
          title: '커뮤니티 가이드라인',
          category: 'policies',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">커뮤니티 가이드라인</h1>
              <p className="text-lg text-muted-foreground">
                건전한 커뮤니티를 위한 이용 수칙입니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">금지 사항</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>타인에 대한 비방, 욕설, 혐오 표현</li>
                  <li>저작권 침해 콘텐츠</li>
                  <li>불법 정보 또는 유해 콘텐츠</li>
                  <li>스팸 및 광고성 게시물</li>
                </ul>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'account',
      title: '계정 관리',
      icon: <FiUsers className="w-4 h-4" />,
      articles: [
        {
          id: 'change-password',
          title: '비밀번호 변경',
          category: 'account',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">비밀번호 변경</h1>
              <p className="text-lg text-muted-foreground">
                계정 보안을 위해 정기적으로 비밀번호를 변경하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">변경 방법</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>설정 → 보안으로 이동</li>
                  <li>현재 비밀번호 입력</li>
                  <li>새 비밀번호 입력 (8자 이상)</li>
                  <li>새 비밀번호 확인</li>
                  <li>변경 버튼 클릭</li>
                </ol>
              </section>
            </div>
          )
        },
        {
          id: 'change-email',
          title: '이메일 변경',
          category: 'account',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">이메일 변경</h1>
              <p className="text-lg text-muted-foreground">
                로그인에 사용하는 이메일 주소를 변경할 수 있습니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">변경 절차</h2>
                <p className="text-muted-foreground">
                  설정 메뉴에서 이메일을 변경할 수 있습니다. 
                  변경 후 새 이메일로 인증을 완료해야 합니다.
                </p>
              </section>
            </div>
          )
        },
        {
          id: 'delete-account',
          title: '계정 삭제',
          category: 'account',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">계정 삭제</h1>
              <p className="text-lg text-muted-foreground">
                계정을 영구적으로 삭제합니다
              </p>
              
              <div className="bg-accent border border-border rounded-lg p-4">
                <p className="text-destructive">
                  <strong>주의:</strong> 계정 삭제 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
                </p>
              </div>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">삭제되는 데이터</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>모든 블로그 글</li>
                  <li>댓글 및 좋아요</li>
                  <li>프로필 정보</li>
                  <li>설정 및 환경설정</li>
                </ul>
              </section>
            </div>
          )
        },
        {
          id: '2fa',
          title: '2단계 인증',
          category: 'account',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">2단계 인증</h1>
              <p className="text-lg text-muted-foreground">
                계정 보안을 강화하는 2단계 인증을 설정하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">설정 방법</h2>
                <p className="text-muted-foreground">
                  설정 → 보안에서 2단계 인증을 활성화할 수 있습니다.
                  Google Authenticator 또는 SMS 인증을 사용할 수 있습니다.
                </p>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'writing',
      title: '글쓰기 및 편집',
      icon: <FiFileText className="w-4 h-4" />,
      articles: [
        {
          id: 'markdown',
          title: '마크다운 가이드',
          category: 'writing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">마크다운 가이드</h1>
              <p className="text-lg text-muted-foreground">
                마크다운 문법을 익혀 더 풍부한 콘텐츠를 작성하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">기본 문법</h2>
                
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-2">제목</h3>
                  <pre className="text-sm text-muted-foreground font-mono">
{`# 제목 1
## 제목 2
### 제목 3`}
                  </pre>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-2">강조</h3>
                  <pre className="text-sm text-muted-foreground font-mono">
{`**굵은 글씨**
*기울임체*
~~취소선~~`}
                  </pre>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-2">목록</h3>
                  <pre className="text-sm text-muted-foreground font-mono">
{`- 항목 1
- 항목 2
  - 하위 항목

1. 첫 번째
2. 두 번째`}
                  </pre>
                </div>
              </section>
            </div>
          )
        },
        {
          id: 'images',
          title: '이미지 업로드',
          category: 'writing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">이미지 업로드</h1>
              <p className="text-lg text-muted-foreground">
                글에 이미지를 추가하는 방법을 알아보세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">업로드 방법</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>드래그 앤 드롭으로 이미지 추가</li>
                  <li>이미지 버튼 클릭 후 파일 선택</li>
                  <li>클립보드에서 붙여넣기 (Ctrl+V)</li>
                </ul>
                
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    <strong>지원 형식:</strong> JPG, PNG, GIF (최대 10MB)
                  </p>
                </div>
              </section>
            </div>
          )
        },
        {
          id: 'scheduling',
          title: '글 예약 발행',
          category: 'writing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">글 예약 발행</h1>
              <p className="text-lg text-muted-foreground">
                원하는 시간에 글이 자동으로 발행되도록 예약하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">현재 상태</h2>
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-foreground">
                    예약 발행 기능은 현재 개발 중입니다. 곧 사용하실 수 있습니다.
                  </p>
                </div>
              </section>
            </div>
          )
        },
        {
          id: 'comments',
          title: '댓글 관리',
          category: 'writing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">댓글 관리</h1>
              <p className="text-lg text-muted-foreground">
                블로그 댓글을 효과적으로 관리하는 방법입니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">댓글 설정</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>댓글 허용/차단 설정</li>
                  <li>스팸 댓글 자동 필터링</li>
                  <li>댓글 알림 설정</li>
                  <li>부적절한 댓글 신고 및 삭제</li>
                </ul>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'billing',
      title: '결제 및 요금',
      icon: <FiCreditCard className="w-4 h-4" />,
      articles: [
        {
          id: 'plans',
          title: '요금제 비교',
          category: 'billing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">요금제 비교</h1>
              <p className="text-lg text-muted-foreground">
                필요에 맞는 요금제를 선택하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">무료 플랜</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>무제한 글 작성</li>
                  <li>기본 통계</li>
                  <li>5GB 저장 공간</li>
                </ul>
              </section>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">프로 플랜</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>무료 플랜의 모든 기능</li>
                  <li>고급 통계 및 분석</li>
                  <li>50GB 저장 공간</li>
                  <li>우선 지원</li>
                </ul>
              </section>
            </div>
          )
        },
        {
          id: 'payment',
          title: '결제 방법',
          category: 'billing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">결제 방법</h1>
              <p className="text-lg text-muted-foreground">
                다양한 결제 수단을 지원합니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">지원 결제 수단</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>신용카드/체크카드</li>
                  <li>카카오페이</li>
                  <li>네이버페이</li>
                  <li>페이팔</li>
                </ul>
              </section>
            </div>
          )
        },
        {
          id: 'refund',
          title: '환불 정책',
          category: 'billing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">환불 정책</h1>
              <p className="text-lg text-muted-foreground">
                구매 후 7일 이내 전액 환불이 가능합니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">환불 절차</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>고객센터 문의</li>
                  <li>환불 사유 작성</li>
                  <li>환불 승인</li>
                  <li>3-5일 내 환불 완료</li>
                </ol>
              </section>
            </div>
          )
        },
        {
          id: 'receipts',
          title: '영수증 다운로드',
          category: 'billing',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">영수증 다운로드</h1>
              <p className="text-lg text-muted-foreground">
                결제 영수증을 다운로드할 수 있습니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">다운로드 방법</h2>
                <p className="text-muted-foreground">
                  설정 → 결제 내역에서 영수증을 PDF로 다운로드할 수 있습니다.
                </p>
              </section>
            </div>
          )
        }
      ]
    },
    {
      id: 'api',
      title: 'API 및 개발자',
      icon: <FiTool className="w-4 h-4" />,
      articles: [
        {
          id: 'getting-started',
          title: 'API 시작하기',
          category: 'api',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">API 시작하기</h1>
              <p className="text-lg text-muted-foreground">
                MyBlog API를 사용하여 블로그를 프로그래밍 방식으로 관리하세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">API 키 발급</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>설정 → API 키로 이동</li>
                  <li>새 API 키 생성 클릭</li>
                  <li>키 이름 입력</li>
                  <li>권한 설정</li>
                  <li>생성된 키 안전하게 보관</li>
                </ol>
              </section>
            </div>
          )
        },
        {
          id: 'api-keys',
          title: 'API 키 관리',
          category: 'api',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">API 키 관리</h1>
              <p className="text-lg text-muted-foreground">
                API 키를 안전하게 관리하는 방법입니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">보안 권장사항</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>API 키를 코드에 직접 포함하지 마세요</li>
                  <li>환경 변수를 사용하세요</li>
                  <li>정기적으로 키를 교체하세요</li>
                  <li>사용하지 않는 키는 삭제하세요</li>
                </ul>
              </section>
            </div>
          )
        },
        {
          id: 'reference',
          title: 'API 레퍼런스',
          category: 'api',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">API 레퍼런스</h1>
              <p className="text-lg text-muted-foreground">
                사용 가능한 API 엔드포인트 목록입니다
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">주요 엔드포인트</h2>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                  <p>GET /api/v1/posts - 글 목록 조회</p>
                  <p>POST /api/v1/posts - 새 글 작성</p>
                  <p>PUT /api/v1/posts/:id - 글 수정</p>
                  <p>DELETE /api/v1/posts/:id - 글 삭제</p>
                </div>
              </section>
            </div>
          )
        },
        {
          id: 'webhooks',
          title: '웹훅 설정',
          category: 'api',
          content: (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground">웹훅 설정</h1>
              <p className="text-lg text-muted-foreground">
                이벤트 발생 시 자동으로 알림을 받으세요
              </p>
              
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">지원 이벤트</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>새 글 발행</li>
                  <li>댓글 작성</li>
                  <li>좋아요 추가</li>
                  <li>구독자 추가</li>
                </ul>
              </section>
            </div>
          )
        }
      ]
    }
  ];

  // Initialize with first article or from URL param
  useEffect(() => {
    const articleParam = searchParams.get('article');
    if (articleParam) {
      setSelectedArticle(articleParam);
      // Expand the category that contains this article
      const category = categories.find(cat => 
        cat.articles.some(art => art.id === articleParam)
      );
      if (category) {
        setExpandedCategories(new Set([category.id]));
      }
    } else {
      // Default to first article
      const firstArticle = categories[0]?.articles[0]?.id;
      if (firstArticle) {
        setSelectedArticle(firstArticle);
        setExpandedCategories(new Set([categories[0].id]));
      }
    }
  }, [searchParams]);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleArticleClick = (articleId: string, categoryId: string) => {
    setSelectedArticle(articleId);
    // Update URL without page reload
    const newUrl = `/help-center/docs?article=${articleId}`;
    window.history.pushState({}, '', newUrl);
    
    // Ensure category is expanded
    if (!expandedCategories.has(categoryId)) {
      setExpandedCategories(new Set([...expandedCategories, categoryId]));
    }
  };

  // Find current article content
  const currentArticle = categories
    .flatMap(cat => cat.articles)
    .find(article => article.id === selectedArticle);

  // Filter articles based on search
  const filteredCategories = searchQuery
    ? categories.map(cat => ({
        ...cat,
        articles: cat.articles.filter(article =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.articles.length > 0)
    : categories;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/help-center"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="고객센터로 돌아가기"
              >
                <FiArrowLeft className="w-5 h-5 text-foreground" />
              </Link>
              <h1 className="text-xl font-semibold text-foreground">고객센터 문서</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-border bg-muted overflow-y-auto">
          <div className="p-4">
            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="문서 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-foreground bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>

            {/* Categories and Articles */}
            <nav className="space-y-2">
              {filteredCategories.map((category) => (
                <div key={category.id}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <div className="flex items-center text-foreground">
                      {category.icon}
                      <span className="ml-2">{category.title}</span>
                    </div>
                    {expandedCategories.has(category.id) ? (
                      <FiChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <FiChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {expandedCategories.has(category.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {category.articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => handleArticleClick(article.id, category.id)}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                            selectedArticle === article.id
                              ? 'bg-accent text-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {article.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-7xl p-8">
            {currentArticle ? (
              currentArticle.content
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">문서를 선택해주세요</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}