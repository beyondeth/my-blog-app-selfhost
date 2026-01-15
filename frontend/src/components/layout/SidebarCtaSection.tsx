"use client";

import React from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';
import SidebarSection from './SidebarSection';

const SidebarCtaSection = React.memo(function SidebarCtaSection() {
  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>당신의 커뮤니티를 만들어요</span>
        </div>
      }
    >
      <p className="mb-4 text-sm text-[#4B5563] dark:text-[#C7D1DD]">
        아이디어가 있다면 지금 바로 커뮤니티를 만들어 사람들과 함께 성장해보세요.
      </p>
      <Link
        href="/c/create"
        className="inline-flex w-full items-center justify-center rounded-full border border-[#D9E0EA] bg-[#F7F9FC] px-3.5 py-2.5 text-sm font-medium text-[#1B2430] hover:bg-[#EEF3F8] transition-colors dark:border-[#4B5563] dark:bg-[#131A22] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
      >
        커뮤니티 만들기
      </Link>
    </SidebarSection>
  );
});

export default SidebarCtaSection;
