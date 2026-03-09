"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import SidebarSection from "./SidebarSection";

const OPEN_CHAT_URL = "https://open.kakao.com/o/gRTCEBki";

export default function KakaoOpenChatSection() {
  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>오픈채팅</span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#E5D47A] bg-[#FEE500] px-4 py-3 text-[#1B1B1B]">
          <p className="text-sm font-semibold">제품 이야기 나누는 공간입니다.</p>
          <p className="mt-1 text-sm text-[#2F2F2F]">질문과 피드백을 편하게 남겨주세요.</p>
        </div>

        <Link
          href={OPEN_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center rounded-2xl bg-[#264653] px-4 py-3 text-sm font-semibold text-[#F9FBFD] shadow-sm transition-colors hover:bg-[#2F5B6B] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0]"
        >
          참여하기
        </Link>
      </div>
    </SidebarSection>
  );
}
