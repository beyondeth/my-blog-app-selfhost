import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 | My Blog',
  description: '개인정보 수집 및 이용에 관한 방침을 확인하세요.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 왼쪽 사이드바(80px) 고려한 중앙 정렬 컨테이너 */}
      <div className="mx-auto max-w-4xl px-4 py-12 lg:ml-32">
        {/* 헤더 */}
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-4xl font-bold text-foreground">개인정보처리방침</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            시행일자: 2025년 1월 10일
          </p>
        </div>

        {/* 본문 */}
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* 1. 개요 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">1. 개요</h2>
            <p className="text-muted-foreground leading-relaxed">
              DevLog(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관련 법령을 준수하고 있습니다.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              본 개인정보처리방침은 회사가 제공하는 서비스 이용 과정에서 수집되는 개인정보의 항목, 수집 및 이용 목적, 보유 및 이용 기간, 파기 절차 등을 안내합니다.
            </p>
          </section>

          {/* 2. 수집하는 개인정보 항목 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">2. 수집하는 개인정보 항목</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">2.1 필수 수집 항목</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                회원가입 및 서비스 이용을 위해 다음 정보를 필수로 수집합니다:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">이메일 주소</strong>: 계정 식별 및 로그인, 중요 공지사항 전달</li>
                <li><strong className="text-foreground">비밀번호</strong>: 계정 보안 (암호화 저장)</li>
                <li><strong className="text-foreground">사용자명</strong>: 서비스 내 프로필 표시</li>
                <li><strong className="text-foreground">가입일시</strong>: 계정 관리</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">2.2 선택 수집 항목</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                서비스 이용 과정에서 다음 정보를 선택적으로 수집할 수 있습니다:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>프로필 이미지, 자기소개(Bio)</li>
                <li>이름 (결제 시 필요)</li>
                <li>블로그 정보: 블로그명, 설명, 슬러그</li>
                <li>게시물 정보: 제목, 내용, 이미지, 파일 첨부</li>
                <li><strong className="text-foreground">DM(다이렉트 메시지)</strong>: 발신/수신 메시지 내용, 시간</li>
                <li>댓글 정보: 댓글 내용, 작성 시간</li>
                <li><strong className="text-foreground">구독 정보</strong>: 구독 요금제, 결제 정보</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">2.3 자동 수집 항목</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>서비스 이용 기록: 접속 로그, 쿠키, 접속 IP</li>
                <li>기기 정보: 브라우저 종류, OS 정보, 기기 식별자</li>
                <li>위치 정보: 접속 국가/지역 (IP 기반)</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">2.4 OAuth 로그인 시 수집 정보</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                소셜 로그인(Google, GitHub, Kakao) 이용 시:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>이메일 주소, 프로필 이미지</li>
                <li>사용자명, OAuth Provider ID</li>
              </ul>
            </div>
          </section>

          {/* 3. 개인정보의 수집 및 이용 목적 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">3. 개인정보의 수집 및 이용 목적</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">3.1 회원 관리</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>회원 가입 의사 확인 및 본인 식별</li>
                  <li>계정 생성 및 관리</li>
                  <li>부정 이용 방지 및 비인가 사용 방지</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">3.2 서비스 제공</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>블로그 플랫폼 서비스 제공</li>
                  <li>게시물 작성, 수정, 삭제 기능 제공</li>
                  <li>댓글 및 <strong className="text-foreground">DM(다이렉트 메시지)</strong> 기능 제공</li>
                  <li>파일 업로드 및 저장 서비스 제공</li>
                  <li><strong className="text-foreground">유료 구독 서비스</strong> 제공 (FREE/PRO 요금제)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 4. 개인정보의 보유 및 이용 기간 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">4. 개인정보의 보유 및 이용 기간</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">4.1 회원 탈퇴 시 즉시 처리</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                회원이 계정 삭제를 요청하는 경우:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li><strong className="text-foreground">즉시 조치</strong>: 개인정보 마스킹 처리 및 로그인 차단</li>
                <li><strong className="text-foreground">마스킹 대상</strong>: 이메일, 사용자명, 프로필 이미지, 비밀번호, 소개</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">4.2 법정 보유 의무</h3>
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">전자상거래 등에서의 소비자보호에 관한 법률</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 text-sm">
                    <li>계약 또는 청약철회 등에 관한 기록: <strong className="text-foreground">5년</strong></li>
                    <li>대금결제 및 재화 등의 공급에 관한 기록: <strong className="text-foreground">5년</strong></li>
                    <li>소비자의 불만 또는 분쟁처리에 관한 기록: <strong className="text-foreground">3년</strong></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">통신비밀보호법</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 text-sm">
                    <li>서비스 이용 기록 (접속 로그, IP 주소): <strong className="text-foreground">3개월</strong></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">4.4 DM(다이렉트 메시지) 데이터 관리</h3>
              <div className="bg-accent/10 border border-accent rounded-lg p-6">
                <h4 className="font-semibold text-foreground mb-3">DM 발신/수신 기록</h4>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong className="text-foreground">보유 기간</strong>: 회원 탈퇴 시까지 또는 메시지 삭제 요청 시까지</li>
                  <li><strong className="text-foreground">삭제 요청 시</strong>: 발신자가 삭제한 메시지는 30일 후 완전 삭제</li>
                  <li><strong className="text-foreground">계정 탈퇴 시</strong>: 발신/수신한 모든 메시지는 상대방 보관함에서는 유지되나, 탈퇴 회원 정보는 마스킹 처리</li>
                </ul>
                <h4 className="font-semibold text-foreground mb-3 mt-4">DM 자동 삭제</h4>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>양측 모두 삭제한 경우: 즉시 완전 삭제</li>
                  <li>한쪽만 삭제한 경우: 30일 후 해당 사용자 보관함에서만 삭제</li>
                  <li>신고된 메시지: 법적 분쟁 해결 시까지 보관 (최대 3년)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 5. 개인정보 파기 절차 및 방법 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">5. 개인정보 파기 절차 및 방법</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">5.1 파기 절차</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">소프트 삭제</strong>: 회원 탈퇴 요청 즉시 개인정보 마스킹 및 로그인 차단</li>
                <li><strong className="text-foreground">백그라운드 처리</strong>: 비동기 큐를 통해 관련 데이터 삭제 작업 진행
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>S3 파일 삭제</li>
                    <li>관련 테이블 CASCADE 정리</li>
                    <li>삭제 로그 기록</li>
                  </ul>
                </li>
                <li><strong className="text-foreground">법적 보유기간 관리</strong>: 법령에 따라 보유해야 하는 정보는 별도 DB에 분리 보관</li>
                <li><strong className="text-foreground">완전 삭제</strong>: 법적 보유기간 만료 시 자동 완전 삭제</li>
              </ol>
            </div>
          </section>

          {/* 6. 개인정보 제3자 제공 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">6. 개인정보 제3자 제공</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 다음의 서비스 제공을 위해 개인정보를 공유할 수 있습니다:
            </p>

            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">AWS S3 (파일 저장)</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">제공받는 자:</strong> Amazon Web Services, Inc.</li>
                  <li><strong className="text-foreground">제공 항목:</strong> 프로필 이미지, 게시물 이미지, 첨부 파일 및 메타데이터</li>
                  <li><strong className="text-foreground">제공 목적:</strong> 클라우드 파일 저장 및 전송</li>
                  <li><strong className="text-foreground">보유 기간:</strong> 회원 탈퇴 또는 파일 삭제 시까지</li>
                </ul>
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Stripe (결제 처리)</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">제공받는 자:</strong> Stripe, Inc.</li>
                  <li><strong className="text-foreground">제공 항목:</strong> 이메일, 이름, 결제 정보</li>
                  <li><strong className="text-foreground">제공 목적:</strong> 유료 구독 결제 처리 및 정산</li>
                  <li><strong className="text-foreground">보유 기간:</strong> 법령에 따른 보유 기간 (5년)</li>
                </ul>
              </div>

              <div className="bg-accent/10 border border-accent rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">OAuth 제공자 (소셜 로그인)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  회원이 OAuth 제공자를 통해 로그인할 경우, 해당 제공자로부터 다음 정보를 제공받습니다:
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">Google</h4>
                    <p className="text-sm text-muted-foreground">이메일, 프로필 이미지, 사용자명</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">Kakao</h4>
                    <p className="text-sm text-muted-foreground">이메일, 프로필 이미지, 닉네임</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">GitHub</h4>
                    <p className="text-sm text-muted-foreground">이메일, 프로필 이미지, 사용자명</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-background rounded border border-border">
                  <p className="text-xs text-muted-foreground">
                    ⚠️ <strong className="text-foreground">중요</strong>: OAuth 로그인 시 회사는 제공자로부터 최소한의 정보만 수집하며, 비밀번호는 제공받지 않습니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 7. 개인정보의 안전성 확보 조치 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">7. 개인정보의 안전성 확보 조치</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">7.1 기술적 조치</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>개인정보 암호화: 비밀번호는 <strong className="text-foreground">bcrypt 암호화</strong> 저장</li>
                  <li>접근 통제: 개인정보 처리 시스템에 대한 접근 권한 관리</li>
                  <li>HTTPS 통신: 전송 구간 암호화 (TLS 1.3)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">7.2 관리적 조치</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>개인정보 취급자 교육: 연 2회 정기 교육</li>
                  <li>접근 권한 관리: 최소 권한 원칙 적용</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 8. 이용자의 권리 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">8. 이용자 및 법정대리인의 권리와 행사 방법</h2>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">8.1 개인정보 열람 요구권</h3>
                <p className="text-sm text-muted-foreground">
                  이용자는 언제든지 본인의 개인정보를 조회하거나 수정할 수 있습니다.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2 text-sm">
                  <li><strong className="text-foreground">방법:</strong> 설정 &gt; 프로필 설정 메뉴</li>
                  <li><strong className="text-foreground">요청 처리:</strong> 즉시 제공 (최대 3영업일)</li>
                </ul>
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">8.4 계정 삭제 요구권</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  이용자는 언제든지 계정을 삭제할 수 있습니다.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-4 text-sm">
                  <li>즉시 개인정보 마스킹 및 로그인 차단</li>
                  <li>백그라운드 삭제 작업 진행</li>
                  <li>법적 보유 의무 데이터는 보유 기간 후 자동 삭제</li>
                </ol>
              </div>
            </div>
          </section>

          {/* 연락처 */}
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">9. 개인정보 보호책임자</h2>
            <div className="bg-muted/50 rounded-lg p-6">
              <ul className="space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">성명:</strong> DevLog 개인정보 보호책임자</li>
                <li><strong className="text-foreground">이메일:</strong> privacy@devlog.com</li>
                <li><strong className="text-foreground">전화:</strong> (미정)</li>
              </ul>
            </div>
          </section>

          {/* 권익침해 구제방법 */}
          <section className="mt-8 pt-8 border-t border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">10. 권익침해 구제방법</h2>
            <p className="text-muted-foreground mb-4">
              개인정보 침해로 인한 신고나 상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">개인정보 침해신고센터:</strong> (국번 없이) 118 |{' '}
                <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  privacy.kisa.or.kr
                </a>
              </li>
              <li>
                <strong className="text-foreground">개인정보 분쟁조정위원회:</strong> (국번 없이) 1833-6972 |{' '}
                <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  kopico.go.kr
                </a>
              </li>
              <li>
                <strong className="text-foreground">대검찰청 사이버범죄수사단:</strong> (국번 없이) 1301 |{' '}
                <a href="https://www.spo.go.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  spo.go.kr
                </a>
              </li>
              <li>
                <strong className="text-foreground">경찰청 사이버안전국:</strong> (국번 없이) 182 |{' '}
                <a href="https://cyberbureau.police.go.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  cyberbureau.police.go.kr
                </a>
              </li>
            </ul>
          </section>

          {/* 전체 방침 보기 링크 */}
          <div className="mt-8 text-center">
            <a
              href="/backend/docs/PRIVACY_POLICY.md"
              className="inline-flex items-center text-sm text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              전체 개인정보처리방침 보기 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
