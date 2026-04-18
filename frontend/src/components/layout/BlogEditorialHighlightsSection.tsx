"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import type { Post } from "@/types";
import { hexToRgbaString } from "@/lib/color";
import { shouldDisableOptimization } from "@/utils/imageUtils";

interface BlogEditorialHighlightsSectionProps {
  blogSlug: string;
  posts: Post[];
  brandColor?: string | null;
  className?: string;
}

function resolvePostHref(blogSlug: string, post: Post) {
  return `/${blogSlug}/${post.slug || post.id}`;
}

function resolvePostImage(post: Post) {
  if (post.thumbnail) return post.thumbnail;
  if (Array.isArray(post.images)) {
    return post.images.find((image) => Boolean(image && image.trim())) ?? null;
  }
  return null;
}

function formatPostDate(value?: string) {
  if (!value) return "Recently updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently updated";

  return parsed.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function resolveAuthorName(post: Post) {
  return post.author?.name || post.author?.username || "익명";
}

function resolveExcerpt(post: Post) {
  return post.editorPickExcerpt || post.excerpt || "요약이 아직 정리되지 않았습니다.";
}

function FeaturedCard({
  post,
  blogSlug,
  accentColor,
}: {
  post: Post;
  blogSlug: string;
  accentColor?: string | null;
}) {
  const href = resolvePostHref(blogSlug, post);
  const image = resolvePostImage(post);
  const categoryTone = accentColor || "#264653";
  const categoryFill = hexToRgbaString(categoryTone, 0.14) || "#D8E6EA";
  const categoryBorder = hexToRgbaString(categoryTone, 0.2) || "#D9E0EA";
  const categoryText = accentColor || "#264653";

  return (
    <Link
      href={href}
      className="group relative min-h-[420px] overflow-hidden rounded-[32px] border border-[#D9E0EA] bg-white shadow-sm transition-transform duration-300 hover:-translate-y-0.5 dark:border-[#2A3645] dark:bg-[#131A22]"
    >
      {image ? (
        <>
          <Image
            src={image}
            alt={post.title}
            fill
            sizes="(max-width: 1279px) 100vw, 720px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized={shouldDisableOptimization(image)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/88 via-[#111827]/34 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(38,70,83,0.14),_transparent_48%),linear-gradient(180deg,#F8FAFC_0%,#EEF3F8_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(108,195,178,0.12),_transparent_48%),linear-gradient(180deg,#111923_0%,#0E141B_100%)]" />
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6 sm:p-7">
        <span
          className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm"
          style={{
            backgroundColor: categoryFill,
            borderColor: categoryBorder,
            color: image ? "#F8FAFC" : categoryText,
          }}
        >
          {post.category || "Archive"}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        <div className="max-w-2xl">
          <div className={`flex flex-wrap items-center gap-2 text-xs ${image ? "text-white/82" : "text-[#526072] dark:text-[#9EB0C2]"}`}>
            <span>{resolveAuthorName(post)}</span>
            <span className="h-1 w-1 rounded-full bg-current/70" aria-hidden="true" />
            <span>{formatPostDate(post.publishedAt || post.createdAt)}</span>
          </div>
          <h3 className={`mt-3 text-2xl font-semibold leading-tight sm:text-[2rem] ${image ? "text-white" : "text-[#1B2430] dark:text-[#E6EDF3]"}`}>
            {post.title}
          </h3>
          <p
            className={`mt-3 max-w-xl text-sm leading-6 sm:text-[15px] ${
              image ? "text-white/84" : "text-[#4B5563] dark:text-[#A9B4C2]"
            }`}
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
              overflow: "hidden",
            }}
          >
            {resolveExcerpt(post)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CompactCard({
  post,
  blogSlug,
  accentColor,
}: {
  post: Post;
  blogSlug: string;
  accentColor?: string | null;
}) {
  const href = resolvePostHref(blogSlug, post);
  const image = resolvePostImage(post);
  const chipColor = accentColor || "#264653";
  const chipFill = hexToRgbaString(chipColor, 0.1) || "#D8E6EA";
  const chipText = accentColor || "#264653";

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[#D9E0EA] bg-white p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 dark:border-[#2A3645] dark:bg-[#131A22]"
    >
      <div className="relative overflow-hidden rounded-[22px] bg-[#EEF3F8] dark:bg-[#111923]">
        {image ? (
          <Image
            src={image}
            alt={post.title}
            width={960}
            height={720}
            sizes="(max-width: 1023px) 100vw, 360px"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized={shouldDisableOptimization(image)}
          />
        ) : (
          <div className="flex aspect-[4/3] items-end bg-[radial-gradient(circle_at_top_left,_rgba(38,70,83,0.12),_transparent_45%),linear-gradient(180deg,#F8FAFC_0%,#E7EDF5_100%)] p-4 dark:bg-[radial-gradient(circle_at_top_left,_rgba(108,195,178,0.12),_transparent_45%),linear-gradient(180deg,#111923_0%,#0E141B_100%)]">
            <span
              className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                backgroundColor: chipFill,
                color: chipText,
              }}
            >
              {post.category || "Note"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#667085] dark:text-[#98A2B3]">
          <span>{resolveAuthorName(post)}</span>
          <span className="h-1 w-1 rounded-full bg-current/70" aria-hidden="true" />
          <span>{formatPostDate(post.publishedAt || post.createdAt)}</span>
        </div>
        <h3 className="mt-2 text-[17px] font-semibold leading-6 text-[#1B2430] transition-colors group-hover:text-[#264653] dark:text-[#E6EDF3] dark:group-hover:text-[#9FE2D7]">
          {post.title}
        </h3>
        <p
          className="mt-2 text-sm leading-6 text-[#4B5563] dark:text-[#A9B4C2]"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {resolveExcerpt(post)}
        </p>
      </div>
    </Link>
  );
}

export default function BlogEditorialHighlightsSection({
  blogSlug,
  posts,
  brandColor,
  className,
}: BlogEditorialHighlightsSectionProps) {
  if (posts.length === 0) {
    return null;
  }

  const featuredPost = posts[0];
  const sidePosts = posts.slice(1, 3);
  const gridPosts = posts.slice(3, 7);

  return (
    <section className={className}>
      <div className="rounded-[34px] border border-[#D9E0EA] bg-[#F7F9FC] p-6 shadow-sm dark:border-[#2A3645] dark:bg-[#131A22] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#264653] dark:text-[#6CC3B2]">
              Recent Blog Posts
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#1B2430] dark:text-[#E6EDF3] md:text-[2rem]">
              이 블로그의 최신 아카이브
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#4B5563] dark:text-[#A9B4C2] md:text-[15px]">
              먼저 큰 흐름을 한 번에 훑고, 이어서 작은 카드들로 최근에 쌓인 글의 결을 빠르게
              읽을 수 있게 정리했습니다.
            </p>
          </div>
          <a
            href="#blog-post-tabs"
            className="inline-flex items-center gap-2 rounded-full border border-[#D9E0EA] bg-white px-4 py-2 text-sm font-semibold text-[#1B2430] shadow-sm transition-colors hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#111923] dark:text-[#E6EDF3] dark:hover:bg-[#16212C]"
          >
            전체 글 보기
            <FiArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(300px,0.72fr)]">
            <FeaturedCard post={featuredPost} blogSlug={blogSlug} accentColor={brandColor} />

            {sidePosts.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                {sidePosts.map((post) => (
                  <CompactCard
                    key={post.id}
                    post={post}
                    blogSlug={blogSlug}
                    accentColor={brandColor}
                  />
                ))}
              </div>
            )}
          </div>

          {gridPosts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {gridPosts.map((post) => (
                <CompactCard
                  key={post.id}
                  post={post}
                  blogSlug={blogSlug}
                  accentColor={brandColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
