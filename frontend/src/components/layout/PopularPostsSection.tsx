"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiBarChart2 } from "react-icons/fi";
import { usePopularPosts } from "@/hooks/usePopularPosts";
import { normalizeImageUrl } from "@/utils/imageUtils";
import SidebarSection from "./SidebarSection";

const AuthorAvatar = ({
  src,
  label,
}: {
  src?: string | null;
  label?: string | null;
}) => {
  const normalizedSrc = src ? normalizeImageUrl(src) : "";

  if (normalizedSrc) {
    return (
      <Image
        src={normalizedSrc}
        alt={label ?? "작성자"}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="h-8 w-8 rounded-full bg-[#D8E6EA] text-[#264653] flex items-center justify-center text-xs font-semibold dark:bg-[#1D3A36] dark:text-[#B9E6DC]">
      {label?.charAt(0).toUpperCase() ?? "U"}
    </div>
  );
};

const PopularPostsSection = React.memo(function PopularPostsSection() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const { data, isLoading, error } = usePopularPosts(period);
  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);

  return (
    <SidebarSection
      title={
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FiBarChart2 className="w-4 h-4 text-[#264653] dark:text-[#6CC3B2]" />
            <span>인기 블로그 포스트</span>
          </div>
          <div className="flex gap-2">
            {['daily', 'weekly', 'monthly'].map((value) => (
              <button
                key={value}
                onClick={() => setPeriod(value as 'daily' | 'weekly' | 'monthly')}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  period === value
                    ? 'bg-[#264653] text-[#F9FBFD] border-[#264653] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:border-[#6CC3B2]'
                    : 'text-[#4B5563] border-[#D9E0EA] hover:text-[#1B2430] hover:bg-[#EEF3F8] dark:text-[#C7D1DD] dark:border-[#2A3645] dark:hover:text-[#E6EDF3] dark:hover:bg-[#1A232E]'
                }`}
              >
                {value === 'daily' ? '일일' : value === 'weekly' ? '주간' : '월간'}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#2A3645]">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className="flex gap-3 py-3 px-5 first:pt-0 last:pb-0"
            >
              <div className="w-8 h-8 bg-[#DCE3EC] dark:bg-[#223040] rounded-full animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[#DCE3EC] dark:bg-[#223040] rounded w-1/3"></div>
                <div className="h-4 bg-[#DCE3EC] dark:bg-[#223040] rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-4 text-[#4B5563] dark:text-[#C7D1DD]">
          <p className="text-sm">인기 포스트를 불러올 수 없습니다.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-4 text-[#4B5563] dark:text-[#C7D1DD]">
          <p className="text-sm">아직 인기 포스트가 없습니다.</p>
        </div>
      ) : (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#4B5563]">
          {posts.map((post: any, index: number) => (
            <Link
              key={post.id}
              href={`/${post.blog?.slug}/${post.slug || post.id}`}
              className="flex items-center gap-3 py-3 px-5 first:pt-0 last:pb-0 transition-colors hover:bg-[#F9FAFB] dark:hover:bg-[#1A232E]"
            >
              <AuthorAvatar
                src={post.author?.profileImage ?? post.author?.profile?.profileImage ?? undefined}
                label={post.author?.username ?? post.author?.email ?? ""}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#3F4A59] dark:text-[#E1E8F0]">{post.author?.username ?? "알 수 없음"}</p>
                <p className="text-sm font-medium text-[#1B2430] dark:text-[#E6EDF3] line-clamp-2">{post.title}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SidebarSection>
  );
});

export default PopularPostsSection;
