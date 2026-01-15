/**
 * 평판 시스템 - 리더보드 컴포넌트
 *
 * 기간별 상위 사용자 순위를 표시하는 리더보드 UI입니다.
 *
 * @example
 * <ReputationLeaderboard period="l7" limit={50} />
 */
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useReputationLeaderboard } from '../hooks/useReputationLeaderboard';
import TitleBadge from './TitleBadge';
import { LevelBadge } from '@/components/ui/LevelBadge';
import type { LeaderboardPeriod } from '../api/reputation';

interface ReputationLeaderboardProps {
  /** 초기 기간 (기본값: 'l7') */
  initialPeriod?: LeaderboardPeriod;
  /** 표시할 상위 N명 (기본값: 50) */
  limit?: number;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 평판 리더보드 컴포넌트
 */
export default function ReputationLeaderboard({
  initialPeriod = 'l7',
  limit = 50,
  className = '',
}: ReputationLeaderboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const { data, isLoading, error, refetch } = useReputationLeaderboard(
    period,
    limit,
  );

  // 기간 탭 변경 핸들러
  const handlePeriodChange = (newPeriod: LeaderboardPeriod) => {
    setPeriod(newPeriod);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🏆 평판 리더보드
          </h2>
          <button
            onClick={() => refetch()}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            disabled={isLoading}
          >
            {isLoading ? '갱신 중...' : '새로고침'}
          </button>
        </div>

        {/* 기간 탭 */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => handlePeriodChange('l7')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'l7'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            최근 7일
          </button>
          <button
            onClick={() => handlePeriodChange('l30')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'l30'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            최근 30일
          </button>
          <button
            onClick={() => handlePeriodChange('l90')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'l90'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            최근 90일
          </button>
          <button
            onClick={() => handlePeriodChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'all'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            🏆 전체 (누적)
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="p-6">
        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="text-center py-8 text-red-600 dark:text-red-400">
            <p>리더보드를 불러오는데 실패했습니다.</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* 빈 상태 */}
        {data && data.entries.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>아직 리더보드 데이터가 없습니다.</p>
          </div>
        )}

        {/* 리더보드 목록 */}
        {data && data.entries.length > 0 && (
          <div className="space-y-3">
            {data.entries.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center p-4 rounded-lg ${
                  index < 3
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                {/* 순위 */}
                <div className="w-12 flex-shrink-0">
                  <span
                    className={`text-2xl font-bold ${
                      index === 0
                        ? 'text-yellow-500'
                        : index === 1
                          ? 'text-gray-400'
                          : index === 2
                            ? 'text-amber-600'
                            : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {entry.rank}
                  </span>
                </div>

                {/* 아바타 */}
                <div className="flex-shrink-0 mr-4">
                  {entry.avatarUrl ? (
                    <Image
                      src={entry.avatarUrl}
                      alt={entry.username}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        {entry.username?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 사용자명 및 타이틀 */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
                    {entry.username}
                    <LevelBadge userId={entry.userId} />
                  </p>
                  {entry.titles && entry.titles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.titles.map((titleCode) => (
                        <TitleBadge key={titleCode} titleCode={titleCode} size="sm" />
                      ))}
                    </div>
                  )}
                </div>

                {/* 점수 */}
                <div className="flex-shrink-0 text-right">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {entry.score.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                    pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 푸터 정보 */}
        {data && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            <p>
              총 {data.totalParticipants.toLocaleString()}명 참가 ·
              마지막 갱신: {new Date(data.lastUpdatedAt).toLocaleString('ko-KR')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
