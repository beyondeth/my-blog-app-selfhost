'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash2,
  AlertTriangle,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { DeletedUser } from '@/lib/api/endpoints/admin';
import type { Post, Comment } from '@/types';

// 날짜 포매팅 유틸리티 함수 - null, undefined, 잘못된 날짜 값 처리
const formatDateSafely = (dateValue: any, formatStr: string = 'yyyy-MM-dd'): string => {
  if (!dateValue || dateValue === null || dateValue === undefined) {
    return 'N/A';
  }

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return format(date, formatStr, { locale: ko });
  } catch {
    return 'N/A';
  }
};

export default function DeletedUsersPage() {
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [limit] = useState(20);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [searchQuery, setSearchQuery] = useState('');

  // 영구 삭제 확인 다이얼로그
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: DeletedUser | null;
  }>({ open: false, user: null });

  // 법적 조회 다이얼로그 (원본 데이터)
  const [legalDialog, setLegalDialog] = useState<{
    open: boolean;
    userId: string | null;
    loading: boolean;
    data: any | null;
  }>({ open: false, userId: null, loading: false, data: null });

  // 포스트 내용 펼치기/접기 상태
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  // 포스트 내용 토글
  const togglePostContent = (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // 삭제된 사용자 목록 조회
  const fetchDeletedUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.admin.getDeletedUsers({
        page,
        limit,
        sortBy: 'deletedAt',
        sortOrder,
        search: searchQuery || undefined,
      });

      setDeletedUsers(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      console.error('Failed to fetch deleted users:', error);
      toast.error('삭제된 사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 검색 처리
  const handleSearch = () => {
    setPage(1); // 검색 시 첫 페이지로 이동
    fetchDeletedUsers();
  };

  // 검색 초기화
  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
    // searchQuery가 빈 문자열로 변경되면 useEffect가 자동 호출됨
  };

  useEffect(() => {
    fetchDeletedUsers();
  }, [page, sortOrder, searchQuery]);

  // 즉시 영구 삭제
  const handlePermanentDelete = async (user: DeletedUser) => {
    try {
      await apiClient.admin.permanentDeleteUser(user.id);
      toast.success(`${user.username || user.email} 사용자가 영구 삭제되었습니다.`);
      setDeleteDialog({ open: false, user: null });
      fetchDeletedUsers(); // 목록 새로고침
    } catch (error) {
      console.error('Failed to permanently delete user:', error);
      toast.error('사용자 삭제에 실패했습니다.');
    }
  };

  // 법적 조회: 원본 데이터 조회
  const handleViewLegalData = async (userId: string) => {
    setLegalDialog({ open: true, userId, loading: true, data: null });

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/users/legal/user-data/${userId}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('원본 데이터 조회에 실패했습니다');
      }

      const data = await response.json();
      setLegalDialog({ open: true, userId, loading: false, data });
    } catch (error) {
      console.error('Failed to fetch legal data:', error);
      toast.error('원본 데이터 조회에 실패했습니다.');
      setLegalDialog({ open: false, userId: null, loading: false, data: null });
    }
  };

  // 남은 일수에 따른 색상
  const getDaysRemainingColor = (days: number) => {
    if (days <= 0) return 'text-red-600 font-bold';
    if (days <= 30) return 'text-orange-600';
    if (days <= 90) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">삭제된 사용자 관리</h1>
            <p className="text-gray-500 mt-2">
              삭제된 사용자는 180일 후 자동으로 완전 삭제됩니다. (총 {total}명)
            </p>
          </div>

          {/* 정렬 */}
          <Select
            value={sortOrder}
            onValueChange={(value: 'ASC' | 'DESC') => setSortOrder(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DESC">최근 삭제순</SelectItem>
              <SelectItem value="ASC">오래된 삭제순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 검색창 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="원본 이메일 또는 사용자명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            검색
          </Button>
          {searchQuery && (
            <Button variant="outline" onClick={handleClearSearch}>
              초기화
            </Button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            삭제된 사용자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : deletedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              삭제된 사용자가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>사용자명</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>삭제일</TableHead>
                    <TableHead>삭제 예정일</TableHead>
                    <TableHead>남은 일수</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">
                        {user.email}
                      </TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDateSafely(user.deletedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatDateSafely(user.scheduledDeletionAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={getDaysRemainingColor(user.daysRemaining)}
                        >
                          {user.daysRemaining <= 0
                            ? '삭제 대기'
                            : `${user.daysRemaining}일`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {/* 원본 데이터 보기 버튼 (법적 조회) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewLegalData(user.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            원본
                          </Button>

                          {/* 즉시 삭제 버튼 */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, user })
                            }
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            영구 삭제
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-sm">
                {page} / {totalPages} 페이지
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 영구 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, user: deleteDialog.user })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              즉시 영구 삭제
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2 mt-4">
                <p>
                  <strong>{deleteDialog.user?.username}</strong> 사용자를
                  영구적으로 삭제하시겠습니까?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-semibold mb-1">경고:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          <strong>복구 불가능:</strong> 이 작업은 되돌릴 수
                          없습니다.
                        </li>
                        <li>
                          <strong>데이터 손실:</strong> 모든 관련 데이터가 DB에서
                          완전히 삭제됩니다.
                        </li>
                        <li>
                          <strong>CASCADE 삭제:</strong> 블로그, 포스트, 댓글
                          등이 모두 삭제됩니다.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, user: null })}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteDialog.user && handlePermanentDelete(deleteDialog.user)
              }
            >
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 법적 조회: 원본 데이터 Modal */}
      <Dialog
        open={legalDialog.open}
        onOpenChange={(open) =>
          setLegalDialog({ open, userId: null, loading: false, data: null })
        }
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              법적 조회: 삭제된 사용자 원본 데이터
            </DialogTitle>
            <DialogDescription asChild>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <div className="font-semibold mb-1">법적 주의사항:</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <strong>법적 요구 시에만 사용:</strong> 형사 수사, 민사
                        소송, 금융감독 등
                      </li>
                      <li>
                        <strong>무단 조회 금지:</strong> 개인정보보호법 위반 시
                        처벌 대상
                      </li>
                      <li>
                        <strong>조회 기록 보관:</strong> 이 조회는 감사 로그에
                        영구 기록됩니다
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {legalDialog.loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">원본 데이터를 조회하는 중...</p>
            </div>
          ) : legalDialog.data ? (
            <div className="space-y-6">
              {/* 사용자 원본 정보 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  원본 사용자 정보
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">이메일 (원본):</span>
                    <p className="font-mono font-semibold text-blue-600 mt-1">
                      {legalDialog.data.originalData?.email}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">사용자명 (원본):</span>
                    <p className="font-semibold mt-1">
                      {legalDialog.data.originalData?.username}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">역할:</span>
                    <p className="mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          legalDialog.data.originalData?.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {legalDialog.data.originalData?.role}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">인증 방식:</span>
                    <p className="mt-1 capitalize">
                      {legalDialog.data.originalData?.authProvider}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">마지막 로그인 방식:</span>
                    <p className="mt-1 capitalize">
                      {legalDialog.data.originalData?.lastLoginProvider || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">이메일 인증:</span>
                    <p className="mt-1">
                      {legalDialog.data.originalData?.isEmailVerified
                        ? '✅ 인증됨'
                        : '❌ 미인증'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">가입일:</span>
                    <p className="mt-1">
                      {legalDialog.data.originalData?.createdAt &&
                        format(
                          new Date(legalDialog.data.originalData.createdAt),
                          'yyyy-MM-dd HH:mm',
                          { locale: ko }
                        )}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">마지막 로그인:</span>
                    <p className="mt-1">
                      {legalDialog.data.originalData?.lastLoginAt
                        ? format(
                            new Date(legalDialog.data.originalData.lastLoginAt),
                            'yyyy-MM-dd HH:mm',
                            { locale: ko }
                          )
                        : 'N/A'}
                    </p>
                  </div>
                  {legalDialog.data.originalData?.subscriptionTier && (
                    <>
                      <div>
                        <span className="text-gray-500">구독 등급:</span>
                        <p className="mt-1 capitalize">
                          {legalDialog.data.originalData.subscriptionTier}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">구독 상태:</span>
                        <p className="mt-1 capitalize">
                          {legalDialog.data.originalData.subscriptionStatus}
                        </p>
                      </div>
                    </>
                  )}
                  {legalDialog.data.originalData?.bio && (
                    <div className="col-span-2">
                      <span className="text-gray-500">소개:</span>
                      <p className="mt-1 text-gray-700">
                        {legalDialog.data.originalData.bio}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 삭제 정보 */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  삭제 정보
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">삭제일:</span>
                    <p className="font-semibold mt-1">
                      {formatDateSafely(legalDialog.data.deletedAt, 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">완전 삭제 예정일:</span>
                    <p className="font-semibold mt-1">
                      {formatDateSafely(legalDialog.data.scheduledDeletionAt, 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 삭제된 포스트 목록 */}
              {legalDialog.data.deletedPosts && legalDialog.data.deletedPosts.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    📝 삭제된 포스트 ({legalDialog.data.deletedPosts.length}개)
                  </h3>
                  <div className="space-y-3">
                    {legalDialog.data.deletedPosts.map((post: Post) => (
                      <div key={post.id} className="bg-white rounded p-3 text-sm border border-purple-200">
                        <div className="font-semibold text-gray-900 mb-1">{post.title}</div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>카테고리: {post.category}</div>
                          <div className="flex gap-3">
                            <span>조회수: {post.viewCount}</span>
                            <span>좋아요: {post.likeCount}</span>
                            <span>댓글: {post.commentCount}</span>
                          </div>
                          <div>작성일: {formatDateSafely(post.createdAt, 'yyyy-MM-dd HH:mm')}</div>
                        </div>

                        {/* 내용 보기 버튼 */}
                        <button
                          onClick={() => togglePostContent(post.id)}
                          className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                        >
                          {expandedPosts.has(post.id) ? (
                            <>내용 숨기기 ▲</>
                          ) : (
                            <>내용 보기 ▼</>
                          )}
                        </button>

                        {/* 펼쳐진 내용 (HTML 렌더링) */}
                        {expandedPosts.has(post.id) && (
                          <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto">
                            <div className="text-xs text-gray-500 mb-2 font-semibold">
                              ⚖️ 법적 증거 자료 (포스트 내용)
                            </div>
                            <div
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: post.content }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 삭제된 댓글 목록 */}
              {legalDialog.data.deletedComments && legalDialog.data.deletedComments.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    💬 삭제된 댓글 ({legalDialog.data.deletedComments.length}개)
                  </h3>
                  <div className="space-y-3">
                    {legalDialog.data.deletedComments.slice(0, 20).map((comment: Comment) => (
                      <div key={comment.id} className="bg-white rounded p-3 text-sm border border-green-200">
                        <div className="text-gray-800 mb-2">{comment.content}</div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>포스트 ID: {comment.postId}</div>
                          <div className="flex gap-3">
                            <span>좋아요: {comment.likesCount}</span>
                            <span>작성일: {formatDateSafely(comment.createdAt, 'yyyy-MM-dd HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {legalDialog.data.deletedComments.length > 20 && (
                      <div className="text-xs text-gray-500 text-center pt-2">
                        ...외 {legalDialog.data.deletedComments.length - 20}개 댓글
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 법적 고지 */}
              {legalDialog.data.legalNotice && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-600" />
                    법적 고지사항
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 font-semibold">
                        ⚠️ 경고:
                      </span>
                      <p className="text-gray-700 mt-1">
                        {legalDialog.data.legalNotice.warning}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-semibold">
                        📋 사용 목적:
                      </span>
                      <p className="text-gray-700 mt-1">
                        {legalDialog.data.legalNotice.purpose}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-semibold">
                        🕐 보관 기간:
                      </span>
                      <p className="text-gray-700 mt-1">
                        {legalDialog.data.legalNotice.retention}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-gray-600 font-semibold">
                        👤 조회자:
                      </span>
                      <p className="font-mono text-blue-700 mt-1">
                        {legalDialog.data.legalNotice.inquiredBy}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-semibold">
                        📅 조회 시각:
                      </span>
                      <p className="text-gray-700 mt-1">
                        {legalDialog.data.legalNotice.inquiredAt &&
                          format(
                            new Date(legalDialog.data.legalNotice.inquiredAt),
                            'yyyy-MM-dd HH:mm:ss',
                            { locale: ko }
                          )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setLegalDialog({ open: false, userId: null, loading: false, data: null })
              }
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
