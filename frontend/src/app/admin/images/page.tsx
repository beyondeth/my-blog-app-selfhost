'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Trash2,
  Download,
  Image as ImageIcon,
  FileText,
  Film,
  File,
  Search,
  Filter,
  Eye,
  Copy,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  HardDrive,
  Users,
  Calendar,
  FolderOpen,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatFileSize } from '@/utils/imageConversion';
import { getCDNUrl } from '@/utils/imageConversion';

interface FileItem {
  id: string;
  originalName: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  accessUrl?: string;
  s3Bucket?: string;
  s3Region?: string;
  isOptimized?: boolean;
}

export default function AdminImagesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // 파일 목록 조회
  const { data: filesData, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'files', page, selectedType, selectedUser, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (selectedType !== 'all') params.append('fileType', selectedType);
      if (selectedUser !== 'all') params.append('userId', selectedUser);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/v1/admin/files?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
  });

  // 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'files', 'stats'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${apiUrl}/admin/files/stats`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // 파일 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/v1/admin/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to delete file');
      return response.json();
    },
    onSuccess: () => {
      toast.success('파일이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'files'] });
      setDeleteDialogOpen(false);
      setSelectedFile(null);
    },
    onError: () => {
      toast.error('파일 삭제에 실패했습니다.');
    },
  });

  // 파일 타입 아이콘 가져오기
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (mimeType.startsWith('video/')) return <Film className="w-4 h-4" />;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  // 파일 타입 라벨
  const getFileTypeLabel = (fileType: string) => {
    const labels: Record<string, string> = {
      image: '이미지',
      document: '문서',
      video: '비디오',
      general: '일반',
    };
    return labels[fileType] || fileType;
  };

  // 파일 타입별 색상
  const getFileTypeColor = (fileType: string) => {
    const colors: Record<string, string> = {
      image: 'bg-green-100 text-green-800',
      document: 'bg-blue-100 text-blue-800',
      video: 'bg-purple-100 text-purple-800',
      general: 'bg-gray-100 text-gray-800',
    };
    return colors[fileType] || 'bg-gray-100 text-gray-800';
  };

  // 클립보드 복사
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('클립보드에 복사되었습니다.');
  };

  // 파일 미리보기
  const handlePreview = (file: FileItem) => {
    if (file.mimeType.startsWith('image/')) {
      const cdnUrl = getCDNUrl(file.fileKey, { quality: 90 });
      setPreviewUrl(cdnUrl);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">이미지 관리</h1>
        <p className="text-gray-600">업로드된 모든 파일을 관리합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 파일</p>
              <p className="text-2xl font-bold">{statsData?.totalFiles || 0}</p>
            </div>
            <File className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 용량</p>
              <p className="text-2xl font-bold">
                {formatFileSize(statsData?.totalSize || 0)}
              </p>
            </div>
            <HardDrive className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">사용자 수</p>
              <p className="text-2xl font-bold">{statsData?.userCount || 0}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">WebP 비율</p>
              <p className="text-2xl font-bold">
                {statsData?.webpPercentage || 0}%
              </p>
            </div>
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="파일명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">모든 타입</option>
            <option value="image">이미지</option>
            <option value="document">문서</option>
            <option value="video">비디오</option>
            <option value="general">일반</option>
          </select>
          
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 파일 목록 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  파일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업로드 일시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  최적화
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : filesData?.files?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    파일이 없습니다.
                  </td>
                </tr>
              ) : (
                filesData?.files?.map((file: FileItem) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {file.originalName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {file.fileName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getFileTypeColor(file.fileType)}`}>
                        {getFileTypeLabel(file.fileType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatFileSize(file.fileSize)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {file.user?.username || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.user?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(file.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {file.mimeType === 'image/webp' ? (
                        <span className="text-green-600 text-sm font-medium">WebP</span>
                      ) : file.isOptimized ? (
                        <span className="text-blue-600 text-sm font-medium">최적화됨</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>작업</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {file.mimeType.startsWith('image/') && (
                            <DropdownMenuItem onClick={() => handlePreview(file)}>
                              <Eye className="mr-2 h-4 w-4" />
                              미리보기
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem onClick={() => copyToClipboard(file.fileKey)}>
                            <Copy className="mr-2 h-4 w-4" />
                            S3 키 복사
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => copyToClipboard(getCDNUrl(file.fileKey))}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            CDN URL 복사
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem asChild>
                            <a href={getCDNUrl(file.fileKey)} download={file.originalName}>
                              <Download className="mr-2 h-4 w-4" />
                              다운로드
                            </a>
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedFile(file);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 focus:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {filesData?.totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() => setPage(Math.min(filesData.totalPages, page + 1))}
                disabled={page === filesData.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                다음
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  총 <span className="font-medium">{filesData.total}</span>개 중{' '}
                  <span className="font-medium">{(page - 1) * 20 + 1}</span> -{' '}
                  <span className="font-medium">
                    {Math.min(page * 20, filesData.total)}
                  </span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    {page} / {filesData.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(filesData.totalPages, page + 1))}
                    disabled={page === filesData.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    다음
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>파일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 파일을 삭제하시겠습니까?<br />
              <strong>{selectedFile?.originalName}</strong><br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedFile && deleteMutation.mutate(selectedFile.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 이미지 미리보기 모달 */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}