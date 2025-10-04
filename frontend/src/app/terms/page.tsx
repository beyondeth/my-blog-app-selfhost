import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관 | My Blog',
  description: '서비스 이용약관을 확인하세요.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 왼쪽 사이드바(80px) 고려한 중앙 정렬 컨테이너 */}
      <div className="mx-auto max-w-4xl px-4 py-12 lg:ml-32">
        {/* 헤더 */}
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-4xl font-bold text-foreground">이용약관</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            시행일자: 2025년 1월 10일
          </p>
        </div>

        {/* 본문 */}
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* 제1장 총칙 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">제1장 총칙</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제1조 (목적)</h3>
              <p className="text-muted-foreground leading-relaxed">
                본 약관은 [서비스명] (이하 "회사")이 제공하는 블로그 플랫폼 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제2조 (정의)</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li><strong className="text-foreground">"서비스"</strong>란 회사가 제공하는 블로그 작성, 게시, 댓글, DM(다이렉트 메시지), 파일 업로드 등 일체의 기능을 의미합니다.</li>
                <li><strong className="text-foreground">"이용자"</strong> 또는 <strong className="text-foreground">"회원"</strong>이란 본 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li>
                <li><strong className="text-foreground">"게시물"</strong>이란 회원이 서비스에 게시한 글, 사진, 동영상, 댓글 등 모든 형태의 콘텐츠를 의미합니다.</li>
                <li><strong className="text-foreground">"블로그"</strong>란 회원이 서비스 내에서 운영하는 개인 공간을 의미하며, 1인 1블로그 원칙을 따릅니다.</li>
                <li><strong className="text-foreground">"유료 서비스"</strong>란 회사가 제공하는 구독형 서비스(FREE, PRO 요금제)를 의미합니다.</li>
              </ol>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제3조 (약관의 효력 및 변경)</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
                <li>회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다.</li>
                <li>회사가 약관을 변경할 경우에는 적용일자 및 변경사유를 명시하여 현행약관과 함께 서비스 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.</li>
                <li>회원은 변경된 약관에 동의하지 않을 권리가 있으며, 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
              </ol>
            </div>
          </section>

          {/* 제2장 회원가입 및 계정관리 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">제2장 회원가입 및 계정관리</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제5조 (회원가입)</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li>회원가입은 다음의 방법으로 가능합니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>이메일 주소와 비밀번호를 이용한 직접 가입</li>
                    <li>OAuth 제공자(Google, Kakao, GitHub)를 통한 소셜 로그인 가입</li>
                  </ul>
                </li>
                <li>이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다.</li>
              </ol>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제6조 (회원 탈퇴 및 자격 상실)</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li>회원은 언제든지 서비스 내 계정 설정을 통해 탈퇴를 요청할 수 있으며, 회사는 즉시 회원 탈퇴를 처리합니다.</li>
                <li>회원 탈퇴 시, 다음과 같이 처리됩니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>탈퇴 즉시 로그인 차단 및 서비스 이용 불가</li>
                    <li>회원정보는 「개인정보보호법」 및 관련 법령에 따라 보관되며, 법정 보관 기간(기본 3년) 경과 후 자동 파기</li>
                    <li>파기 7일 전 이메일로 사전 통지</li>
                  </ul>
                </li>
              </ol>
            </div>
          </section>

          {/* 제3장 서비스 이용 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">제3장 서비스 이용</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제8조 (서비스의 제공)</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                회사는 회원에게 다음과 같은 서비스를 제공합니다:
              </p>
              <ul className="list-disc list-inside ml-6 space-y-1 text-muted-foreground">
                <li>블로그 생성 및 관리 (1인 1블로그)</li>
                <li>게시물(글, 사진, 동영상) 작성, 수정, 삭제</li>
                <li>댓글 및 답글 작성</li>
                <li>DM(다이렉트 메시지) 송수신</li>
                <li>파일 업로드 (AWS S3 저장)</li>
                <li>북마크, 팔로우 등 소셜 기능</li>
                <li>유료 구독 서비스 (PRO 요금제)</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제12조 (금지행위)</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                회원은 서비스 이용 시 다음 각 호의 행위를 하여서는 안 됩니다:
              </p>
              <ul className="list-disc list-inside ml-6 space-y-1 text-muted-foreground">
                <li>신청 또는 변경 시 허위내용의 등록</li>
                <li>타인의 정보 도용</li>
                <li>회사 또는 제3자의 저작권 등 지적재산권에 대한 침해</li>
                <li>회사 또는 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                <li>외설 또는 폭력적인 메시지, 화상, 음성 등 공서양속에 반하는 정보를 공개 또는 게시하는 행위</li>
              </ul>
            </div>
          </section>

          {/* 제4장 유료 서비스 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">제4장 유료 서비스 (구독제)</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제13조 (유료 서비스의 종류 및 요금)</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                회사는 다음과 같은 구독 서비스를 제공합니다:
              </p>
              <ul className="list-disc list-inside ml-6 space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">FREE</strong>: 무료 기본 서비스</li>
                <li><strong className="text-foreground">PRO</strong>: 유료 프리미엄 서비스 (추가 기능 및 용량 제공)</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제14조 (결제 방법)</h3>
              <p className="text-muted-foreground leading-relaxed">
                유료 서비스의 결제는 Stripe 결제 시스템을 통해 이루어지며, 신용카드, 체크카드 등의 결제 수단을 이용할 수 있습니다.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">제16조 (청약철회 및 환불)</h3>
              <p className="text-muted-foreground leading-relaxed">
                회원은 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 결제일로부터 7일 이내에 청약철회를 요청할 수 있습니다.
              </p>
            </div>
          </section>

          {/* 연락처 */}
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">개인정보 보호책임자</h2>
            <div className="bg-muted/50 rounded-lg p-6">
              <ul className="space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">이름:</strong> [담당자명]</li>
                <li><strong className="text-foreground">부서:</strong> [부서명]</li>
                <li><strong className="text-foreground">이메일:</strong> [이메일 주소]</li>
                <li><strong className="text-foreground">전화번호:</strong> [전화번호]</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                회원은 서비스 이용과 관련한 모든 개인정보보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의할 수 있습니다.
              </p>
            </div>
          </section>

          {/* 전체 약관 보기 링크 */}
          <div className="mt-8 text-center">
            <a
              href="/backend/docs/TERMS.md"
              className="inline-flex items-center text-sm text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              전체 약관 보기 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
