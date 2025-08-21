'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

export default function TermsOfServicePage() {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-8">이용약관</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>시행일: 2025년 1월 19일</strong>
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제1조 (목적)</h2>
              <p className="text-gray-700">
                이 약관은 MyBlog(이하 "회사")가 제공하는 블로그 플랫폼 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제2조 (정의)</h2>
              <p className="text-gray-700 mb-4">이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>"서비스"</strong>란 회사가 제공하는 블로그 생성, 관리, 콘텐츠 발행 플랫폼을 의미합니다.</li>
                <li><strong>"이용자"</strong>란 이 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</li>
                <li><strong>"회원"</strong>이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며, 회사가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
                <li><strong>"블로그"</strong>란 회원이 서비스를 통해 생성한 개인 블로그 공간을 의미합니다.</li>
                <li><strong>"게시물"</strong>이란 회원이 서비스를 이용함에 있어 블로그에 게시한 글, 사진, 동영상, 각종 파일과 링크 등을 의미합니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제3조 (약관의 게시와 개정)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회사는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.</li>
                <li>회사는 「약관의 규제에 관한 법률」, 「정보통신망이용촉진 및 정보보호 등에 관한 법률」 등 관련법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
                <li>회사가 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 서비스 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.</li>
                <li>회원은 개정된 약관에 대해 거부할 권리가 있으며, 개정된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 회원등록을 해지할 수 있습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제4조 (서비스의 제공 및 변경)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회사는 다음과 같은 서비스를 제공합니다:
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>블로그 생성 및 관리 서비스</li>
                    <li>콘텐츠 작성 및 발행 서비스</li>
                    <li>댓글 및 소통 기능</li>
                    <li>기타 회사가 추가 개발하거나 다른 회사와의 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스</li>
                  </ul>
                </li>
                <li>회사는 서비스의 내용을 변경할 수 있으며, 변경된 서비스의 내용 및 제공일자를 제3조에 정한 방법으로 이용자에게 통지합니다.</li>
                <li>회사는 기술적 필요, 서비스 개선, 기타 상당한 이유가 있는 경우에 제공하고 있는 전부 또는 일부 서비스를 변경할 수 있습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제5조 (회원가입)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.</li>
                <li>회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다:
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>가입신청자가 이 약관 제7조제3항에 의하여 이전에 회원자격을 상실한 경우</li>
                    <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
                    <li>기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우</li>
                  </ul>
                </li>
                <li>회원가입계약의 성립 시기는 회사의 승낙이 회원에게 도달한 시점으로 합니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제6조 (회원 정보의 변경)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회원은 개인정보관리화면을 통하여 언제든지 본인의 개인정보를 열람하고 수정할 수 있습니다.</li>
                <li>회원은 회원가입신청 시 기재한 사항이 변경되었을 경우 온라인으로 수정을 하거나 전자우편 기타 방법으로 회사에 대하여 그 변경사항을 알려야 합니다.</li>
                <li>제2항의 변경사항을 회사에 알리지 않아 발생한 불이익에 대하여 회사는 책임지지 않습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제7조 (회원탈퇴 및 자격 상실 등)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회원은 회사에 언제든지 탈퇴를 요청할 수 있으며 회사는 즉시 회원탈퇴를 처리합니다.</li>
                <li>회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다:
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>가입 신청 시에 허위 내용을 등록한 경우</li>
                    <li>다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를 위협하는 경우</li>
                    <li>서비스를 이용하여 법령 또는 이 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</li>
                  </ul>
                </li>
                <li>회사가 회원 자격을 제한·정지시킨 후, 동일한 행위가 2회 이상 반복되거나 30일 이내에 그 사유가 시정되지 아니하는 경우 회사는 회원자격을 상실시킬 수 있습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제8조 (회원에 대한 통지)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회사가 회원에 대한 통지를 하는 경우, 회원이 회사와 미리 약정하여 지정한 전자우편 주소로 할 수 있습니다.</li>
                <li>회사는 불특정다수 회원에 대한 통지의 경우 1주일 이상 서비스 게시판에 게시함으로써 개별 통지에 갈음할 수 있습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제9조 (이용자의 의무)</h2>
              <p className="text-gray-700 mb-4">이용자는 다음 행위를 하여서는 안 됩니다.</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>신청 또는 변경 시 허위 내용의 등록</li>
                <li>타인의 정보 도용</li>
                <li>회사가 게시한 정보의 변경</li>
                <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
                <li>회사의 동의 없이 영리를 목적으로 서비스를 사용하는 행위</li>
                <li>기타 불법적이거나 부당한 행위</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제10조 (저작권의 귀속 및 이용제한)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회사가 작성한 저작물에 대한 저작권 기타 지적재산권은 회사에 귀속합니다.</li>
                <li>회원이 서비스 내에서 작성한 게시물의 저작권은 해당 게시물의 작성자에게 귀속됩니다.</li>
                <li>회원은 서비스를 이용함으로써 얻은 정보 중 회사에게 지적재산권이 귀속된 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안됩니다.</li>
                <li>회원이 작성한 게시물에 대해 회사는 서비스 내에서 이를 사용, 복제, 수정, 공개, 전송, 배포할 수 있는 권리를 가집니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제11조 (게시물의 관리)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회원의 게시물이 「정보통신망법」 및 「저작권법」 등 관련법에 위반되는 내용을 포함하는 경우, 권리자는 관련법이 정한 절차에 따라 해당 게시물의 게시중단 및 삭제 등을 요청할 수 있으며, 회사는 관련법에 따라 조치를 취하여야 합니다.</li>
                <li>회사는 전항에 따른 권리자의 요청이 없는 경우라도 권리침해가 인정될 만한 사유가 있거나 기타 회사 정책 및 관련법에 위반되는 경우에는 관련법에 따라 해당 게시물에 대해 임시조치 등을 취할 수 있습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제12조 (서비스 이용의 제한)</h2>
              <p className="text-gray-700 mb-4">
                회사는 회원이 이 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 경고, 일시정지, 영구이용정지 등으로 서비스 이용을 단계적으로 제한할 수 있습니다.
              </p>
              <p className="text-gray-700">
                회사는 전항에도 불구하고, 「주민등록법」을 위반한 명의도용 및 결제도용, 「저작권법」을 위반한 불법프로그램의 제공 및 운영방해, 「정보통신망법」을 위반한 불법통신 및 해킹, 악성프로그램의 배포, 접속권한 초과행위 등과 같이 관련법을 위반한 경우에는 즉시 영구이용정지를 할 수 있습니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제13조 (책임제한)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</li>
                <li>회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.</li>
                <li>회사는 회원이 게재한 정보, 자료, 사실의 신뢰도, 정확성 등의 내용에 관하여는 책임을 지지 않습니다.</li>
                <li>회사는 회원 간 또는 회원과 제3자 상호간에 서비스를 매개로 하여 거래 등을 한 경우에는 책임이 면제됩니다.</li>
                <li>회사는 무료로 제공되는 서비스 이용과 관련하여 관련법에 특별한 규정이 없는 한 책임을 지지 않습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">제14조 (준거법 및 재판관할)</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>이 약관의 해석 및 회사와 회원간의 분쟁에 대하여는 대한민국의 법률을 적용합니다.</li>
                <li>서비스 이용 중 발생한 회원과 회사간의 소송은 민사소송법에 의한 관할법원에 제기합니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">부칙</h2>
              <p className="text-gray-700">
                이 약관은 2025년 1월 19일부터 시행합니다.
              </p>
            </section>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}