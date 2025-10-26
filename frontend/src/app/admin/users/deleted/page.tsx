'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  RotateCcw,
  AlertTriangle,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { DeletedUser } from '@/lib/api/endpoints/admin';

export default function DeletedUsersPage() {
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [limit] = useState(20);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // 복구 확인 다이얼로그
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    user: DeletedUser | null;
  }>({ open: false, user: null });

  // 영구 삭제 확인 다이얼로그
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: DeletedUser | null;
  }>({ open: false, user: null });

  // 삭제된 사용자 목록 조회
  const fetchDeletedUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.admin.getDeletedUsers({
        page,
        limit,
        sortBy: 'deletedAt',
        sortOrder,
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

  useEffect(() => {
    fetchDeletedUsers();
  }, [page, sortOrder]);

  // 사용자 복구
  const handleRestore = async (user: DeletedUser) => {
    try {
      await apiClient.admin.restoreUser(user.id);
      toast.success(`${user.username || user.email} 사용자가 복구되었습니다.`);
      setRestoreDialog({ open: false, user: null });
      fetchDeletedUsers(); // 목록 새로고침
    } catch (error) {
      console.error('Failed to restore user:', error);
      toast.error('사용자 복구에 실패했습니다.');
    }
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">삭제된 사용자 관리</h1>
          <p className="text-gray-500 mt-2">
            삭제된 사용자는 180일 후 자동으로 완전 삭제됩니다. (총 {total}명)
          </p>
        </div>

        {/* 정렬 */}
        <div className="flex items-center gap-4">
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
                          {format(new Date(user.deletedAt), 'yyyy-MM-dd', {
                            locale: ko,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {format(
                            new Date(user.scheduledDeletionAt),
                            'yyyy-MM-dd',
                            { locale: ko }
                          )}
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
                          {/* 복구 버튼 */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setRestoreDialog({ open: true, user })
                            }
                            className="text-green-600 hover:bg-green-50"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            복구
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

      {/* 복구 확인 다이얼로그 */}
      <Dialog
        open={restoreDialog.open}
        onOpenChange={(open) =>
          setRestoreDialog({ open, user: restoreDialog.user })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-600" />
              사용자 복구
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2 mt-4">
                <p>
                  <strong>{restoreDialog.user?.username}</strong> 사용자를
                  복구하시겠습니까?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-1">주의사항:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>개인정보는 이미 마스킹되어 복구할 수 없습니다.</li>
                        <li>
                          로그인 기능만 재활성화되며, 이메일 주소는{' '}
                          <code className="bg-yellow-100 px-1 rounded">
                            deleted_xxx
                          </code>{' '}
                          형태로 유지됩니다.
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
              onClick={() => setRestoreDialog({ open: false, user: null })}
            >
              취소
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() =>
                restoreDialog.user && handleRestore(restoreDialog.user)
              }
            >
              복구하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
