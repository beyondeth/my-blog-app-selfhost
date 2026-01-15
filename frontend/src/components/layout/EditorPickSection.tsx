"use client";

import React, { useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiEye, FiMessageCircle, FiTarget } from 'react-icons/fi';
import { useQueryClient } from '@tanstack/react-query';
import SidebarSection from './SidebarSection';
import { useEditorPicks } from '@/hooks/useEditorPicks';
import { useVote } from '@/hooks/useVote';
import { VoteButton } from '@/components/ui/VoteButton';
import type { VoteType } from '@/types';

/**
 * Editor's Pick 섹션 컴포넌트
 * @description 관리자가 선정한 추천 포스트를 표시하는 사이드바 섹션
 * PopularPostsSection과 동일한 디자인/레이아웃 사용
 */
const EditorPickSection = React.memo(function EditorPickSection() {
  const { data, isLoading, error } = useEditorPicks(5); // 최대 5개 노출
  const queryClient = useQueryClient();
  const { mutate: vote } = useVote();

  const posts = data?.posts || [];

  /**
   * 투표 핸들러
   * - 낙관적 업데이트로 에디터 픽 캐시 즉시 업데이트
   * - useVote 훅을 통해 API 호출 및 다른 캐시 동기화
   */
  const handleVote = useCallback(
    (postId: string, voteType: 'upvote' | 'downvote', currentPost: any) => {
      // 에디터 픽 캐시 낙관적 업데이트
      queryClient.setQueryData(['editorPicks', 5], (oldData: any) => {
        if (!oldData?.posts) return oldData;

        return {
          ...oldData,
          posts: oldData.posts.map((post: any) => {
            if (post.id !== postId) return post;

            const currentVote = post.userVote || null;
            let nextVote: VoteType = null;
            let upvoteCount = post.upvoteCount || 0;
            let downvoteCount = post.downvoteCount || 0;

            // 같은 투표 → 취소
            if (currentVote === voteType) {
              nextVote = null;
              if (voteType === 'upvote') upvoteCount--;
              else downvoteCount--;
            }
            // 투표 없음 → 새 투표
            else if (currentVote === null) {
              nextVote = voteType;
              if (voteType === 'upvote') upvoteCount++;
              else downvoteCount++;
            }
            // 다른 투표 → 전환
            else {
              nextVote = voteType;
              if (voteType === 'upvote') {
                upvoteCount++;
                downvoteCount--;
              } else {
                upvoteCount--;
                downvoteCount++;
              }
            }

            return {
              ...post,
              userVote: nextVote,
              upvoteCount,
              downvoteCount,
              score: upvoteCount - downvoteCount,
              likeCount: upvoteCount,
            };
          }),
        };
      });

      // API 호출
      vote({ postId, voteType });
    },
    [queryClient, vote]
  );

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <FiTarget className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span>Pick</span>
        </div>
      }
    >
      {isLoading ? (
        // 로딩 스켈레톤 UI
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // 에러 상태
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">Editor's Pick을 불러올 수 없습니다.</p>
        </div>
      ) : posts.length === 0 ? (
        // 빈 상태
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">아직 선정된 포스트가 없습니다.</p>
        </div>
      ) : (
        // 포스트 목록
        <div className="space-y-3">
          {posts.map((post: any, index: number) => (
            <div
              key={post.id}
              className="flex gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              {/* 순번 표시 */}
              <span className="text-lg font-bold text-gray-300 w-6 text-center">
                {index + 1}
              </span>

              <div className="flex-1 min-w-0">
                {/* 썸네일 이미지 (있을 경우) */}
                {post.thumbnail && (
                  <div className="mb-2">
                    {/* 모바일 버전 */}
                    <div className="block sm:hidden" style={{ width: '100px', height: '94px' }}>
                      <Image
                        src={post.thumbnail}
                        alt={post.title}
                        width={100}
                        height={94}
                        className="w-full h-full rounded-lg object-contain"
                        sizes="100px"
                        priority={index < 3} // 상위 3개는 우선 로딩
                      />
                    </div>

                    {/* 데스크톱 버전 */}
                    <div className="hidden sm:block" style={{ width: '210px', height: '197px' }}>
                      <Image
                        src={post.thumbnail}
                        alt={post.title}
                        width={210}
                        height={197}
                        className="w-full h-full rounded-lg object-contain"
                        sizes="210px"
                        priority={index < 3}
                      />
                    </div>
                  </div>
                )}

                {/* 포스트 제목 */}
                <Link
                  href={`/${post.blog.slug}/${post.slug || post.id}`}
                  className="block hover:text-gray-600 transition-colors"
                >
                  <h4 className="text-[15px] font-medium line-clamp-2 break-words">
                    {post.title}
                  </h4>
                </Link>

                {/* 통계 정보 (조회수, 투표, 댓글) */}
                <div className="flex items-center gap-3 text-[13px] text-gray-500 dark:text-[#cccccc] mt-2">
                  <div className="flex items-center gap-1">
                    <FiEye className="w-3 h-3" />
                    <span>{post.viewCount || 0}</span>
                  </div>
                  <VoteButton
                    upvoteCount={post.upvoteCount || 0}
                    downvoteCount={post.downvoteCount || 0}
                    userVote={post.userVote || null}
                    onVote={(voteType) => handleVote(post.id, voteType, post)}
                    layout="horizontal"
                    compact={true}
                    displayMode="separated"
                  />
                  <div className="flex items-center gap-1">
                    <FiMessageCircle className="w-3 h-3" />
                    <span>{post.commentCount || 0}</span>
                  </div>
                </div>

                {/* 작성자 정보 */}
                {post.author && (
                  <p className="text-xs text-gray-400 mt-1">
                    {post.author.username || post.author.email}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SidebarSection>
  );
});

export default EditorPickSection;
