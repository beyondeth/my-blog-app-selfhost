'use client';

/**
 * 평판 시스템 Admin 페이지
 *
 * 리더보드, 사용자 평판 조회, 수동 집계 등을 제공합니다.
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Image from 'next/image';
import { LevelBadge } from '@/components/ui/LevelBadge';
import {
  ReputationLeaderboard,
  TitleBadge,
  useReputationSummary,
  useReputationLedger,
  runAggregate,
  refreshLeaderboard,
  searchUsers,
  SearchedUser,
} from '@/features/reputation';

export default function ReputationAdminPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [isAggregating, setIsAggregating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: userSummary, isLoading: isSummaryLoading } =
    useReputationSummary(selectedUserId);
  const { data: ledgerData, isLoading: isLedgerLoading } =
    useReputationLedger(selectedUserId, 50, !!selectedUserId);

  const formatActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      POST_PUBLISHED: '포스트 작성',
      COMMENT_ADDED: '댓글 작성',
      LIKE_RECEIVED: '좋아요 받기',
      BOOKMARK_RECEIVED: '북마크 받기',
      REPORT_VALID: '유효한 신고',
      EDITOR_PICKED: "Editor's Pick 선정",
    };
    return labels[actionType] || actionType;
  };

  const formatTarget = (targetType?: string | null, targetId?: string | null) => {
    if (!targetType || !targetId) return '-';
    return `${targetType}:${targetId.slice(0, 8)}`;
  };

  // 검색 디바운스
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchUsers(searchQuery);
        setSearchResults(result.users);
        setShowDropdown(result.users.length > 0);
      } catch (error) {
        console.error('검색 오류:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 사용자 선택 핸들러
  const handleSelectUser = useCallback((user: SearchedUser) => {
    setSelectedUserId(user.id);
    setSearchQuery(user.username);
    setShowDropdown(false);
  }, []);

  // 수동 집계 실행
  const handleRunAggregate = useCallback(async () => {
    setIsAggregating(true);
    try {
      const result = await runAggregate();
      toast.success(`집계 완료! 소요 시간: ${result.elapsed}ms`);
    } catch (error) {
      toast.error('집계 실패: ' + (error as Error).message);
    } finally {
      setIsAggregating(false);
    }
  }, []);

  // 리더보드 갱신
  const handleRefreshLeaderboard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshLeaderboard();
      toast.success(`리더보드 갱신 완료! 소요 시간: ${result.elapsed}ms`);
    } catch (error) {
      toast.error('리더보드 갱신 실패: ' + (error as Error).message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            🏆 평판 시스템 관리
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            사용자 평판, 리더보드, 타이틀을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRunAggregate}
            disabled={isAggregating}
            variant="outline"
          >
            {isAggregating ? '집계 중...' : '📊 수동 집계'}
          </Button>
          <Button
            onClick={handleRefreshLeaderboard}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? '갱신 중...' : '🔄 리더보드 갱신'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="leaderboard">리더보드</TabsTrigger>
          <TabsTrigger value="user-search">사용자 검색</TabsTrigger>
          <TabsTrigger value="stats">통계</TabsTrigger>
        </TabsList>

        {/* 리더보드 탭 */}
        <TabsContent value="leaderboard">
          <ReputationLeaderboard initialPeriod="l7" limit={30} />
        </TabsContent>

        {/* 사용자 검색 탭 */}
        <TabsContent value="user-search">
          <Card>
            <CardHeader>
              <CardTitle>사용자 평판 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Input
                  placeholder="사용자명 또는 이메일을 입력하세요..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  </div>
                )}

                {/* 자동완성 드롭다운 */}
                {showDropdown && (
                  <div className="absolute z-10 w-full max-w-md mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                        onClick={() => handleSelectUser(user)}
                      >
                        {user.profileImage ? (
                          <Image
                            src={user.profileImage}
                            alt={user.username}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                            {user.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {user.username}
                            <LevelBadge userId={user.id} />
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isSummaryLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              )}

              {userSummary && (
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">
                      {userSummary.username || userSummary.userId}
                    </h3>
                    <p className="text-sm text-gray-500">
                      총 획득 점수: {userSummary.totalEarnedScore}점 · 
                      가입 {userSummary.memberDays}일차
                    </p>
                  </div>

                  {/* 기간별 점수 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {userSummary.scores.map((score) => (
                      <Card key={score.period}>
                        <CardContent className="pt-4">
                          <p className="text-sm text-gray-500">{score.period}</p>
                          <p className="text-2xl font-bold">{score.score}</p>
                          {score.rank && (
                            <p className="text-sm text-blue-600">
                              #{score.rank} 위
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* 활성 타이틀 */}
                  {userSummary.activeTitles.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">활성 타이틀</h4>
                      <div className="flex flex-wrap gap-2">
                        {userSummary.activeTitles.map((title) => (
                          <TitleBadge
                            key={title.code}
                            titleCode={title.code}
                            size="md"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-3">최근 평판 히스토리</h4>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                      {isLedgerLoading ? (
                        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          히스토리를 불러오는 중...
                        </div>
                      ) : ledgerData?.entries?.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                                  일시
                                </th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                                  액션
                                </th>
                                <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-200">
                                  점수
                                </th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                                  대상
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {ledgerData.entries.map((entry) => {
                                const recordedAt = new Date(entry.recordedAt);
                                return (
                                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                                      {recordedAt.toLocaleString('ko-KR')}
                                    </td>
                                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                                      {formatActionLabel(entry.actionType)}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <span
                                        className={
                                          entry.delta >= 0
                                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                            : 'text-rose-600 dark:text-rose-400 font-semibold'
                                        }
                                      >
                                        {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                      {formatTarget(entry.targetType, entry.targetId)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          아직 평판 기록이 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 통계 탭 */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>평판 시스템 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-lg">
                  <p className="text-sm opacity-80">총 평판 기록</p>
                  <p className="text-3xl font-bold mt-1">-</p>
                  <p className="text-xs opacity-60 mt-2">
                    (마이그레이션 실행 후 데이터 표시)
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-6 rounded-lg">
                  <p className="text-sm opacity-80">활성 타이틀</p>
                  <p className="text-3xl font-bold mt-1">-</p>
                  <p className="text-xs opacity-60 mt-2">
                    (마이그레이션 실행 후 데이터 표시)
                  </p>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-teal-600 text-white p-6 rounded-lg">
                  <p className="text-sm opacity-80">오늘 점수 변동</p>
                  <p className="text-3xl font-bold mt-1">-</p>
                  <p className="text-xs opacity-60 mt-2">
                    (마이그레이션 실행 후 데이터 표시)
                  </p>
                </div>
              </div>

              {/* 레벨 분포 가이드 */}
              <div className="mt-8">
                <h4 className="font-semibold mb-4 text-gray-900 dark:text-white">🏆 레벨 시스템 가이드</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-200">레벨</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-200">아이콘</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-200">필요 점수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {[
                        { level: 1, icon: '🌱', score: 10 },
                        { level: 2, icon: '📝', score: 50 },
                        { level: 3, icon: '✍️', score: 100 },
                        { level: 4, icon: '🔥', score: 500 },
                        { level: 5, icon: '💎', score: 1000 },
                        { level: 6, icon: '🏆', score: 2000 },
                        { level: 7, icon: '⭐', score: 4000 },
                        { level: 8, icon: '🔮', score: 8000 },
                        { level: 9, icon: '👑', score: 20000 },
                        { level: 10, icon: '🌟', score: 50000 },
                      ].map((item) => (
                        <tr key={item.level} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">Lv{item.level}</td>
                          <td className="px-4 py-2 text-lg">{item.icon}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-300">{item.score.toLocaleString()}+</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  * 레벨은 ALL_TIME 누적 점수 기준으로 계산됩니다. 10점 미만은 레벨이 표시되지 않습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 집계 방식 설명 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">📖 평판 시스템 집계 방식</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 점수 정책 */}
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">🎯 점수 정책</h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2">액션</th>
                    <th className="pb-2">점수</th>
                    <th className="pb-2">대상</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 dark:text-gray-400">
                  <tr><td className="py-1">포스트 작성</td><td>+10</td><td>작성자</td></tr>
                  <tr><td className="py-1">댓글 작성</td><td>+3</td><td>작성자</td></tr>
                  <tr><td className="py-1">좋아요 받기</td><td>+2</td><td>포스트 작성자</td></tr>
                  <tr><td className="py-1">북마크 받기</td><td>+1</td><td>포스트 작성자</td></tr>
                  <tr><td className="py-1">Editor&apos;s Pick 선정</td><td>+30</td><td>포스트 작성자</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 집계 주기 */}
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">⏰ 집계 주기</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li><strong>일일 집계</strong>: 매일 03:00 - 기간별 점수 합산 및 감쇠 적용</li>
              <li><strong>주간 리더보드</strong>: 매주 월요일 04:00 - Redis Sorted Set 갱신</li>
              <li><strong>수동 집계</strong>: 위 버튼으로 즉시 실행 가능</li>
              <li><strong>즉시 반영</strong>: Editor&apos;s Pick 선정은 즉시 ledger 기록 + 리더보드 업데이트</li>
            </ul>
          </div>

          {/* 감쇠 공식 */}
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">📉 감쇠 공식</h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm">
              <code className="text-blue-600 dark:text-blue-400">
                decayedScore = rawScore × 0.9^(일수/7)
              </code>
              <p className="mt-2 text-gray-500">
                7일마다 10% 감소, 최소 10%까지 감쇠 (30일 이상 된 점수)
              </p>
            </div>
          </div>

          {/* 기간별 리더보드 */}
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">📊 기간별 리더보드</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li><strong>L7</strong>: 최근 7일간 감쇠 점수 합산</li>
              <li><strong>L30</strong>: 최근 30일간 감쇠 점수 합산</li>
              <li><strong>L90</strong>: 최근 90일간 감쇠 점수 합산</li>
              <li><strong>ALL_TIME</strong>: 전체 기간 원본 점수 합산 (감쇠 없음)</li>
            </ul>
          </div>

          {/* 셀프 반응 차단 */}
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">🚫 셀프 반응 차단</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              자기 자신의 포스트에 좋아요/북마크를 해도 점수가 부여되지 않습니다.
              다른 사용자의 활동만 평판에 반영됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 용어 및 로직 상세 설명 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">📚 평판 시스템 용어 및 구조 이해하기</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* 핵심 개념 */}
          <div>
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-white text-base">💡 핵심 개념</h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-4">
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">원본 점수 (Raw Score)</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  각 활동에 대해 부여되는 기본 점수입니다. 시간이 지나도 변하지 않는 순수 점수예요.
                </p>
              </div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">감쇠 점수 (Decayed Score)</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  시간이 지나면서 &ldquo;가치가 줄어든&rdquo; 점수입니다. 7일마다 10%씩 감소하여 <strong>최근 활동</strong>에 더 높은 가치를 부여합니다.
                  이를 통해 리더보드에서 현재 활발한 사용자가 상위에 올라갈 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 기간별 의미 */}
          <div>
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-white text-base">📅 기간(Period)이란?</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">기간</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">의미</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">감쇠 적용</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">용도</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">L7</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">최근 7일간의 활동만 집계</td>
                    <td className="px-4 py-2 text-green-600 dark:text-green-400">✅ O</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">주간 리더보드</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">L30</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">최근 30일간의 활동만 집계</td>
                    <td className="px-4 py-2 text-green-600 dark:text-green-400">✅ O</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">월간 리더보드</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">L90</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">최근 90일간의 활동만 집계</td>
                    <td className="px-4 py-2 text-green-600 dark:text-green-400">✅ O</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">분기별 트렌드</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 bg-purple-50 dark:bg-purple-900/20">
                    <td className="px-4 py-2 font-mono font-bold text-purple-700 dark:text-purple-300">ALL_TIME</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">가입 후 모든 활동 누적</td>
                    <td className="px-4 py-2 text-red-600 dark:text-red-400">❌ X</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">레벨·역대 순위</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              💡 <strong>ALL_TIME</strong>은 감쇠가 적용되지 않아 &ldquo;역대 총 공헌도&rdquo;를 나타냅니다.
              레벨(Lv1~Lv10)은 ALL_TIME 점수를 기준으로 계산됩니다.
            </p>
          </div>

          {/* 데이터 흐름 */}
          <div>
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-white text-base">🔄 데이터 흐름</h4>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre className="text-gray-800 dark:text-gray-200">{`사용자 활동 (글쓰기, 댓글, 좋아요 받기)
    ↓
[reputation_ledger] 개별 기록 저장
    ↓ (매일 새벽 3시 집계)
[reputation_total] 기간별 합산 점수 계산
    ├── L7:       score + decayed_score
    ├── L30:      score + decayed_score
    ├── L90:      score + decayed_score
    └── ALL_TIME: score (감쇠 없음, 레벨 계산용)
    ↓
[Redis Leaderboard] 순위 캐싱
    ↓
Admin 페이지 표시`}</pre>
            </div>
          </div>

          {/* 왜 이렇게 설계했나 */}
          <div>
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-white text-base">🎯 왜 이렇게 설계했나요?</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">🏃</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">최근 활동 장려</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    L7/L30 리더보드는 감쇠를 적용해 &ldquo;지금 활발한 사용자&rdquo;가 상위권에 오르도록 합니다.
                    과거에 많이 활동했더라도 최근에 안 하면 순위가 내려갑니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🏆</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">역대 공헌자 인정</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ALL_TIME은 감쇠 없이 순수 누적이므로 &ldquo;역대 얼마나 기여했는지&rdquo;를 보여줍니다.
                    레벨(Lv5 💎)은 이 점수로 계산되어 오랜 기여자에게 명예를 부여합니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">⚖️</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">신규 vs 기존 유저 균형</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    신규 유저도 열심히 하면 L7 리더보드에서 상위권에 갈 수 있고,
                    오랜 기여자는 ALL_TIME과 높은 레벨로 인정받습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
