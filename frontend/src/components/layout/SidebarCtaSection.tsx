"use client";

import React from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';
import SidebarSection from './SidebarSection';

const SidebarCtaSection = React.memo(function SidebarCtaSection() {
  const copy = {
    title: 'Launch your community',
    description: 'Create a focused space for your niche, bring the right people together, and grow it over time.',
    cta: 'Create a community',
  };

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[#264653] dark:text-[#6CC3B2]" />
          <span>{copy.title}</span>
        </div>
      }
    >
      <p className="mb-4 text-sm text-[#4B5563] dark:text-[#C7D1DD]">
        {copy.description}
      </p>
      <Link
        href="/c/create"
        className="inline-flex w-full items-center justify-center rounded-full border border-[#D9E0EA] bg-[#F7F9FC] px-3.5 py-2.5 text-sm font-medium text-[#1B2430] hover:bg-[#EEF3F8] transition-colors dark:border-[#4B5563] dark:bg-[#131A22] dark:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
      >
        {copy.cta}
      </Link>
    </SidebarSection>
  );
});

export default SidebarCtaSection;
