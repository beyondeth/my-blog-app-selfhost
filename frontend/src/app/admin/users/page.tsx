'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Shield,
  Download,
  RefreshCw,
  Mail,
  Calendar,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/constants/adminTranslations';
import { useAdminUsers, useUpdateUserRole, useToggleUserStatus } from '@/hooks/useAdmin';

interface User {
  id: string;
  email: string;
  username: string;
  profileImage?: string;
  role: 'user' | 'moderator' | 'admin';
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  stats?: {
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    accountAge: number;
    lastActivity: Date | null;
  };
  _count?: {
    posts: number;
    comments: number;
  };
}

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'suspend' | 'ban' | 'activate' | 'role' | null;
    user: User | null;
  }>({ open: false, action: null, user: null });
  const [newRole, setNewRole] = useState<string>('user');

  // Use the admin users hook
  const { data, isLoading: loading, refetch: fetchUsers } = useAdminUsers(page, 20, {
    search: searchTerm || undefined,
    role: roleFilter || undefined,
    isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
  });
  const updateRoleMutation = useUpdateUserRole();
  const toggleStatusMutation = useToggleUserStatus();

  const users = data?.users || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const handleUserAction = async (userId: string, action: string, payload?: any) => {
    try {
      if (action === 'update' && payload?.role) {
        // Update user role
        await updateRoleMutation.mutateAsync({ userId, role: payload.role });
      } else if (action === 'suspend' || action === 'ban') {
        // Suspend or ban user (set inactive)
        await toggleStatusMutation.mutateAsync({ userId, isActive: false });
      } else if (action === 'activate') {
        // Activate user
        await toggleStatusMutation.mutateAsync({ userId, isActive: true });
      } else {
        // For other actions, use direct API call
        const endpoint = `/admin/users/${userId}/${action}`;
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}${endpoint}`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload || {}),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || `Failed to ${action} user`);
        }
        toast.success(`사용자 ${action}이(가) 성공했습니다`);
      }
      
      fetchUsers();
      setActionDialog({ open: false, action: null, user: null });
    } catch (error: any) {
      console.error(`Error ${action} user:`, error);
      toast.error(error.message || `사용자 ${action}에 실패했습니다`);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/users/export?format=csv`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export users');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('사용자 내보내기가 성공했습니다');
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('사용자 내보내기에 실패했습니다');
    }
  };

  // No need for client-side filtering since we're using server-side filtering
  const filteredUsers = users;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t.users.title}</h1>
        <p className="text-gray-600 mt-1">{t.users.subtitle}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.dashboard.totalUsers}</p>
                <p className="text-2xl font-semibold">{users.length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.dashboard.activeUsers}</p>
                <p className="text-2xl font-semibold">
                  {users.filter((u: any) => u.isActive).length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.status.verified}</p>
                <p className="text-2xl font-semibold">
                  {users.filter((u: any) => u.isEmailVerified).length}
                </p>
              </div>
              <Mail className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t.users.admin}</p>
                <p className="text-2xl font-semibold">
                  {users.filter((u: any) => u.role === 'admin').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t.users.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter || 'all'} onValueChange={(value) => {
              setRoleFilter(value === 'all' ? '' : value);
              setPage(1);
            }}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="역할로 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 역할</SelectItem>
                <SelectItem value="user">{t.users.user}</SelectItem>
                <SelectItem value="moderator">{t.users.moderator}</SelectItem>
                <SelectItem value="admin">{t.users.admin}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter || 'all'} onValueChange={(value) => {
              setStatusFilter(value === 'all' ? '' : value);
              setPage(1);
            }}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="상태로 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="active">{t.status.active}</SelectItem>
                <SelectItem value="inactive">{t.status.inactive}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => fetchUsers()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t.actions.refresh}
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {t.actions.export}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.users.username}</TableHead>
                <TableHead>{t.users.role}</TableHead>
                <TableHead>{t.users.status}</TableHead>
                <TableHead>포스트</TableHead>
                <TableHead>{t.users.joinDate}</TableHead>
                <TableHead>{t.users.lastLogin}</TableHead>
                <TableHead className="text-right">{t.users.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    사용자를 찾을 수 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar 
                          src={user.profileImage} 
                          alt={user.username}
                          fallback={user.username}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? t.status.active : t.status.inactive}
                        </span>
                        {user.isEmailVerified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {t.status.verified}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.stats?.totalPosts || user._count?.posts || 0}</TableCell>
                    <TableCell>
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), 'MMM d, yyyy')
                        : '없음'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setNewRole(user.role);
                              setActionDialog({ open: true, action: 'role', user });
                            }}
                            disabled={user.id === currentUser?.id}
                          >
                            {t.users.changeRole}
                          </DropdownMenuItem>
                          {user.isActive ? (
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ open: true, action: 'suspend', user })}
                              disabled={user.id === currentUser?.id}
                            >
                              사용자 정지
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ open: true, action: 'activate', user })}
                            >
                              사용자 활성화
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setActionDialog({ open: true, action: 'ban', user })}
                            disabled={user.id === currentUser?.id}
                            className="text-red-600"
                          >
                            사용자 차단
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            {t.pagination.previous}
          </Button>
          <span className="flex items-center px-3 text-sm">
            {t.pagination.page} {page} {t.pagination.of} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            {t.pagination.next}
          </Button>
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setActionDialog({ open: false, action: null, user: null });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'role' && '사용자 역할 변경'}
              {actionDialog.action === 'suspend' && '사용자 정지'}
              {actionDialog.action === 'ban' && '사용자 차단'}
              {actionDialog.action === 'activate' && '사용자 활성화'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'role' && '이 사용자의 새 역할을 선택하세요.'}
              {actionDialog.action === 'suspend' && '사용자 계정을 일시적으로 정지합니다.'}
              {actionDialog.action === 'ban' && '사용자를 영구적으로 차단합니다. 이 작업은 실행 취소할 수 없습니다.'}
              {actionDialog.action === 'activate' && '사용자 계정을 다시 활성화합니다.'}
            </DialogDescription>
          </DialogHeader>
          
          {actionDialog.action === 'role' && (
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t.users.user}</SelectItem>
                <SelectItem value="moderator">{t.users.moderator}</SelectItem>
                <SelectItem value="admin">{t.users.admin}</SelectItem>
              </SelectContent>
            </Select>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, action: null, user: null })}
            >
              {t.actions.cancel}
            </Button>
            <Button
              variant={actionDialog.action === 'ban' ? 'destructive' : 'default'}
              onClick={() => {
                if (actionDialog.user && actionDialog.action) {
                  if (actionDialog.action === 'role') {
                    handleUserAction(actionDialog.user.id, 'update', { role: newRole });
                  } else {
                    handleUserAction(actionDialog.user.id, actionDialog.action);
                  }
                }
              }}
            >
              {t.actions.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}