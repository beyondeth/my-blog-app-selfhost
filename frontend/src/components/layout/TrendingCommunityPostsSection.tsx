"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import SidebarSection from "./SidebarSection";
import { getPopularCommunityPosts } from "@/services/api/popular.service";

type Period = "daily" | "weekly" | "monthly";

const Avatar = ({
  src,
  label,
}: {
  src?: string;
  label?: string;
}) => {
  if (src) {
    return (
      <Image
        src={src}
        alt={label ?? "Author"}
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

const TrendingCommunityPostsSection = React.memo(function TrendingCommunityPostsSection() {
  const [period, setPeriod] = useState<Period>("weekly");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["trending-community-posts", period],
    queryFn: () => getPopularCommunityPosts(period, 5),
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const copy = {
    title: 'Trending community posts',
    periodOptions: [
      { label: 'Daily', value: 'daily' as const },
      { label: 'Weekly', value: 'weekly' as const },
      { label: 'Monthly', value: 'monthly' as const },
    ],
    loadError: 'Could not load the data.',
    retry: 'Retry',
    empty: 'No active community posts yet.',
    unknown: 'Unknown',
  };

  return (
    <SidebarSection
      title={
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-[#264653] dark:text-[#6CC3B2]" />
            <span>{copy.title}</span>
          </div>
          <div className="flex gap-2">
            {copy.periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  period === option.value
                    ? "bg-[#264653] text-[#F9FBFD] border-[#264653] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:border-[#6CC3B2]"
                    : "text-[#4B5563] border-[#D9E0EA] hover:text-[#1B2430] hover:bg-[#EEF3F8] dark:text-[#C7D1DD] dark:border-[#2A3645] dark:hover:text-[#E6EDF3] dark:hover:bg-[#1A232E]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#2A3645]">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 py-3 px-5 first:pt-0 last:pb-0"
            >
              <div className="h-8 w-8 rounded-full bg-[#DCE3EC] dark:bg-[#223040] animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-[#DCE3EC] dark:bg-[#223040] rounded w-1/3 animate-pulse" />
                <div className="h-4 bg-[#DCE3EC] dark:bg-[#223040] rounded w-3/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-[#3F4A59] dark:text-[#E1E8F0]">
          {copy.loadError}
          <button className="ml-2 text-[#264653] underline dark:text-[#6CC3B2]" onClick={() => refetch()}>
            {copy.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#3F4A59] dark:text-[#E1E8F0]">{copy.empty}</p>
      ) : (
        <div className="-mx-5 divide-y divide-[#E5E7EB] dark:divide-[#4B5563]">
          {items.map((post) => (
            <Link
              key={post.id}
              href={`/c/${post.community?.slug ?? ""}/comments/${post.slug}`}
              className="flex items-center gap-3 py-3 px-5 first:pt-0 last:pb-0 transition-colors hover:bg-[#F9FAFB] dark:hover:bg-[#1A232E]"
            >
              <Avatar
                src={post.community?.iconUrl}
                label={post.community?.name}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#3F4A59] dark:text-[#E1E8F0]">{post.community?.name ?? copy.unknown}</p>
                <p className="text-sm font-medium text-[#1B2430] dark:text-[#E6EDF3] line-clamp-2">{post.title}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SidebarSection>
  );
});

export default TrendingCommunityPostsSection;
