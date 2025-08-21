'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with navigation */}
      <div className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/help-center"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            고객센터로 돌아가기
          </Link>
        </div>
      </div>
      
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow-lg rounded-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보처리방침</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>시행일: 2025년 1월 19일</strong>
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제1조 (개인정보의 처리 목적)</h2>
              <p className="text-gray-700 mb-4">
                MyBlog(이하 '회사')는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회원 가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지</li>
                <li>블로그 서비스 제공: 블로그 생성 및 관리, 콘텐츠 제공, 맞춤 서비스 제공</li>
                <li>고충처리: 민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지, 처리결과 통보</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제2조 (개인정보의 처리 및 보유 기간)</h2>
              <p className="text-gray-700 mb-4">
                회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회원 정보: 회원 탈퇴 시까지</li>
                <li>서비스 이용 기록: 3년 (전자상거래법에 따른 보관)</li>
                <li>로그인 기록: 1년 (통신비밀보호법)</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제3조 (처리하는 개인정보의 항목)</h2>
              <p className="text-gray-700 mb-4">회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold text-gray-800 mb-2">필수 항목:</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>이메일 주소</li>
                  <li>비밀번호 (암호화 저장)</li>
                  <li>닉네임</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">자동 수집 항목:</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>IP 주소</li>
                  <li>쿠키</li>
                  <li>접속 일시</li>
                  <li>서비스 이용 기록</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제4조 (개인정보의 제3자 제공)</h2>
              <p className="text-gray-700">
                회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제5조 (개인정보처리의 위탁)</h2>
              <p className="text-gray-700">
                회사는 현재 개인정보 처리를 위탁하지 않고 있습니다. 향후 위탁하는 경우, 관련 법령에 따라 위탁 업무 수행 목적 외 개인정보 처리 금지, 기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 계약서 등 문서에 명시하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독하겠습니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제6조 (정보주체와 법정대리인의 권리·의무 및 행사방법)</h2>
              <p className="text-gray-700 mb-4">정보주체는 회사에 대해 언제든지 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>개인정보 열람요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제요구</li>
                <li>처리정지 요구</li>
              </ol>
              <p className="text-gray-700 mt-4">
                권리 행사는 서면, 이메일, 팩스 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체없이 조치하겠습니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제7조 (개인정보의 파기)</h2>
              <p className="text-gray-700 mb-4">
                회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">파기 절차 및 방법:</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>전자적 파일 형태: 복구 불가능한 방법으로 영구 삭제</li>
                  <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제8조 (개인정보의 안전성 확보조치)</h2>
              <p className="text-gray-700 mb-4">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>비밀번호의 암호화: 이용자의 비밀번호는 암호화되어 저장 및 관리</li>
                <li>해킹 등에 대비한 기술적 대책: 보안프로그램 설치, 주기적 갱신·점검</li>
                <li>개인정보에 대한 접근 제한: 데이터베이스 접근권한 부여, 변경, 말소를 통한 관리</li>
                <li>접속기록의 보관 및 위변조 방지: 개인정보처리시스템 접속 기록 6개월 이상 보관</li>
                <li>개인정보의 암호화: 고유식별정보 등 중요 정보는 암호화 조치</li>
                <li>물리적 보관 장소의 접근 제한: 전산실, 자료보관실 등 접근통제</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제9조 (개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항)</h2>
              <p className="text-gray-700 mb-4">
                회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">쿠키의 사용 목적:</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>로그인 상태 유지 (JWT 토큰)</li>
                  <li>이용자 선호 설정 저장</li>
                  <li>서비스 이용 통계 분석</li>
                </ul>
                <p className="text-gray-700 mt-4">
                  이용자는 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 거부 시 일부 서비스 이용에 제한이 있을 수 있습니다.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제10조 (개인정보 보호책임자)</h2>
              <p className="text-gray-700 mb-4">
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">개인정보 보호책임자</h3>
                <ul className="space-y-1 text-gray-700">
                  <li>성명: [책임자 성명]</li>
                  <li>직책: [직책]</li>
                  <li>연락처: privacy@myblog.com</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제11조 (권익침해 구제방법)</h2>
              <p className="text-gray-700 mb-4">
                정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
                <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
                <li>대검찰청: (국번없이) 1301 (www.spo.go.kr)</li>
                <li>경찰청: (국번없이) 182 (ecrm.cyber.go.kr)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제12조 (개인정보처리방침 변경)</h2>
              <p className="text-gray-700">
                이 개인정보처리방침은 2025년 1월 19일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
            </section>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}