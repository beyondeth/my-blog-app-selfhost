'use client';

const tabs = ['프로필', '블로그 설정', '알림', '보안'];

const profileCard = (
  <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-6 space-y-6 text-sm">
    <div className="space-y-3">
      <label className="text-xs font-medium text-gray-700">닉네임</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="flex-1 rounded-2xl border border-gray-200 px-4 py-2.5" defaultValue="techlover" />
        <button className="rounded-2xl bg-gray-900 px-6 py-2 text-sm font-semibold text-white">저장</button>
      </div>
    </div>
  </div>
);

const blogCard = (
  <div className="space-y-4">
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">블로그 이름</p>
        <input className="w-full rounded-2xl border border-gray-200 px-4 py-2.5" defaultValue="내 블로그" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">블로그 설명</p>
        <textarea className="w-full rounded-2xl border border-gray-200 px-4 py-2.5" rows={3} defaultValue="기술 블로그" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">연락처 이메일</p>
          <input className="w-full rounded-2xl border border-gray-200 px-4 py-2.5" defaultValue="admin@example.com" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">시간대</p>
          <select className="w-full rounded-2xl border border-gray-200 px-4 py-2.5">
            <option>Asia/Seoul</option>
            <option>UTC</option>
          </select>
        </div>
      </div>
    </div>
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
      <p className="text-sm font-semibold text-gray-900">브랜딩</p>
      <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500">
        아이콘 / 배너 업로드, 히어로 텍스트 등을 여기에 구성합니다.
      </div>
      <button className="rounded-2xl bg-gray-900 px-6 py-2 text-sm font-semibold text-white">저장</button>
    </div>
  </div>
);

export default function AdminStyleSettingsSamplePage() {
  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-3xl font-semibold text-gray-900">설정</p>
          <p className="text-sm text-gray-500">프로필 / 블로그 / 알림 관리</p>
        </header>

        <div className="rounded-3xl border border-gray-200 bg-white">
          <div className="flex flex-wrap border-b border-gray-100">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                className={`px-4 sm:px-6 py-3 text-sm font-semibold ${
                  index === 0 ? 'text-gray-900 border-b-2 border-[#5054f0]' : 'text-gray-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-8">
            <div>
              <p className="text-base font-semibold text-gray-900">프로필</p>
              <p className="text-sm text-gray-500">계정 기본 정보 관리</p>
            </div>
            {profileCard}

            <div>
              <p className="text-base font-semibold text-gray-900">블로그 설정</p>
              <p className="text-sm text-gray-500">`/settings/blog` 구성 예시</p>
            </div>
            {blogCard}
          </div>
        </div>
      </div>
    </div>
  );
}
