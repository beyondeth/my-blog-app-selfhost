'use client';

/**
 * 관리자 음악 관리 페이지
 * - 음악 파일 업로드 (S3 Presigned URL)
 * - 플레이리스트 관리 (활성화/비활성화, 순서 변경)
 * - 메타데이터 수정
 */

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Music,
  Upload,
  Trash2,
  Edit2,
  Play,
  Pause,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Save,
  X,
  Plus,
  Clock,
  FileAudio,
  HardDrive,
} from 'lucide-react';
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
import type { AdminMusic, formatTime, formatFileSize } from '@/types/music';

// API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// 시간 포맷팅 함수
const formatDuration = (seconds: number | undefined): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 파일 크기 포맷팅 함수
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

interface MusicItem extends AdminMusic {
  // 추가 필드가 있을 수 있음
}

interface EditingMusic {
  id: string;
  displayTitle: string;
  displayArtist: string;
  displayGenre: string; // 관리자 지정 장르
}

export default function AdminMusicPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 상태
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicItem | null>(null);
  const [editingMusic, setEditingMusic] = useState<EditingMusic | null>(null);
  const [previewAudio, setPreviewAudio] = useState<{ id: string; audio: HTMLAudioElement } | null>(null);
  const [genreFilter, setGenreFilter] = useState<string>('all'); // 장르 필터 ('all' = 전체)

  // 음악 목록 조회
  const { data: musicList, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'music'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/music`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch music list');
      return response.json() as Promise<MusicItem[]>;
    },
  });

  // 필터링된 음악 목록 (관리자 지정 장르 기준)
  const filteredMusicList = musicList?.filter((m) => {
    if (genreFilter === 'all') return true;
    return m.displayGenre === genreFilter;
  });

  // 고유 장르 목록 (관리자가 지정한 장르들)
  const uniqueGenres = musicList
    ? Array.from(new Set(musicList.map((m) => m.displayGenre).filter(Boolean))) as string[]
    : [];

  // 통계 계산
  const stats = {
    total: musicList?.length || 0,
    active: musicList?.filter((m) => m.isActive).length || 0,
    totalDuration: musicList?.reduce((sum, m) => sum + (m.duration || 0), 0) || 0,
    totalSize: musicList?.reduce((sum, m) => sum + m.fileSize, 0) || 0,
  };

  // 음악 업로드
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      setUploadProgress(0);

      try {
        // 1. Presigned URL 요청
        const urlResponse = await fetch(`${API_URL}/admin/music/upload-url`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        });

        if (!urlResponse.ok) {
          throw new Error('업로드 URL 생성 실패');
        }

        const { uploadUrl, fileKey } = await urlResponse.json();
        setUploadProgress(20);

        // 2. S3에 직접 업로드
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('S3 업로드 실패');
        }
        setUploadProgress(80);

        // 3. 업로드 완료 알림
        const completeResponse = await fetch(`${API_URL}/admin/music/upload-complete`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileKey,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        });

        if (!completeResponse.ok) {
          throw new Error('업로드 완료 처리 실패');
        }

        setUploadProgress(100);
        return completeResponse.json();
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    onSuccess: () => {
      toast.success('음악이 업로드되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'music'] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || '업로드에 실패했습니다.');
    },
  });

  // 음악 수정
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MusicItem> }) => {
      const response = await fetch(`${API_URL}/admin/music/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('수정 실패');
      return response.json();
    },
    onSuccess: () => {
      toast.success('수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'music'] });
      setEditingMusic(null);
    },
    onError: () => {
      toast.error('수정에 실패했습니다.');
    },
  });

  // 음악 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/admin/music/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('삭제 실패');
      // DELETE 요청은 본문 없이 반환되므로 json() 호출하지 않음
      return;
    },
    onSuccess: () => {
      toast.success('삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'music'] });
      setDeleteDialogOpen(false);
      setSelectedMusic(null);
    },
    onError: () => {
      toast.error('삭제에 실패했습니다.');
    },
  });

  // 활성화/비활성화 토글
  const toggleActive = useCallback(
    (music: MusicItem) => {
      updateMutation.mutate({
        id: music.id,
        data: { isActive: !music.isActive },
      });
    },
    [updateMutation]
  );

  // 파일 선택 처리
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 파일 타입 검증
      const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('MP3 또는 WAV 파일만 업로드할 수 있습니다.');
        return;
      }

      // 파일 크기 검증 (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('파일 크기는 50MB 이하여야 합니다.');
        return;
      }

      uploadMutation.mutate(file);
    },
    [uploadMutation]
  );

  // 미리듣기
  const handlePreview = useCallback(
    (music: MusicItem) => {
      // 기존 오디오 정지
      if (previewAudio) {
        previewAudio.audio.pause();
        if (previewAudio.id === music.id) {
          setPreviewAudio(null);
          return;
        }
      }

      // 새 오디오 재생
      const audio = new Audio(music.audioUrl);
      audio.volume = 0.5;
      audio.play();
      audio.onended = () => setPreviewAudio(null);
      setPreviewAudio({ id: music.id, audio });
    },
    [previewAudio]
  );

  // 편집 시작
  const startEditing = useCallback((music: MusicItem) => {
    setEditingMusic({
      id: music.id,
      displayTitle: music.displayTitle || music.title || '',
      displayArtist: music.displayArtist || music.artist || '',
      displayGenre: music.displayGenre || '',
    });
  }, []);

  // 편집 저장
  const saveEditing = useCallback(() => {
    if (!editingMusic) return;

    updateMutation.mutate({
      id: editingMusic.id,
      data: {
        displayTitle: editingMusic.displayTitle || undefined,
        displayArtist: editingMusic.displayArtist || undefined,
        displayGenre: editingMusic.displayGenre || undefined,
      },
    });
  }, [editingMusic, updateMutation]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Music className="w-8 h-8" />
          음악 관리
        </h1>
        <p className="text-gray-600">BGM 플레이어에 표시될 음악을 관리합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">전체 트랙</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <FileAudio className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">활성 트랙</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <ToggleRight className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">총 재생 시간</p>
              <p className="text-2xl font-bold">{formatDuration(stats.totalDuration)}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">총 용량</p>
              <p className="text-2xl font-bold">{formatSize(stats.totalSize)}</p>
            </div>
            <HardDrive className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">음악 업로드</h2>
          <div className="flex items-center gap-2">
            {/* 장르 필터 */}
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="all">모든 장르</option>
              {/* DB에 있는 장르만 표시 */}
              {uniqueGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
            onChange={handleFileSelect}
            className="hidden"
            id="music-upload"
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-4">
              <div className="animate-pulse">
                <Upload className="w-12 h-12 mx-auto text-blue-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">업로드 중... {uploadProgress}%</p>
              <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <label htmlFor="music-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                클릭하여 음악 파일을 업로드하세요
              </p>
              <p className="text-sm text-gray-500">MP3, WAV (최대 50MB)</p>
            </label>
          )}
        </div>
      </div>

      {/* 음악 목록 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  순서
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  제목 / 아티스트
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  장르
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  길이
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  업로드
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : !filteredMusicList || filteredMusicList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Music className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>
                      {genreFilter !== 'all'
                        ? `${genreFilter} 장르의 음악이 없습니다.`
                        : '업로드된 음악이 없습니다.'}
                    </p>
                    <p className="text-sm mt-2">위 업로드 영역을 클릭하여 음악을 추가하세요.</p>
                  </td>
                </tr>
              ) : (
                filteredMusicList.map((music, index) => (
                  <tr
                    key={music.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      !music.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingMusic?.id === music.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingMusic.displayTitle}
                            onChange={(e) =>
                              setEditingMusic({ ...editingMusic, displayTitle: e.target.value })
                            }
                            placeholder="제목"
                            className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                          />
                          <input
                            type="text"
                            value={editingMusic.displayArtist}
                            onChange={(e) =>
                              setEditingMusic({ ...editingMusic, displayArtist: e.target.value })
                            }
                            placeholder="아티스트"
                            className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {music.displayTitle || music.title || music.originalName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {music.displayArtist || music.artist || '알 수 없는 아티스트'}
                          </div>
                        </div>
                      )}
                    </td>
                    {/* 장르 컬럼 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingMusic?.id === music.id ? (
                        <>
                          {/* 커스텀 입력 가능한 datalist 방식 */}
                          <input
                            type="text"
                            list="genre-options"
                            value={editingMusic.displayGenre}
                            onChange={(e) =>
                              setEditingMusic({ ...editingMusic, displayGenre: e.target.value })
                            }
                            placeholder="장르 선택 또는 입력"
                            className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                          />
                          <datalist id="genre-options">
                            {uniqueGenres.map((genre) => (
                              <option key={genre} value={genre} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            music.displayGenre
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {music.displayGenre || '미지정'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDuration(music.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatSize(music.fileSize)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleActive(music)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          music.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {music.isActive ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            활성
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            비활성
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(music.createdAt), 'yyyy-MM-dd', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {/* 미리듣기 */}
                        <button
                          onClick={() => handlePreview(music)}
                          className={`p-2 rounded-full transition-colors ${
                            previewAudio?.id === music.id
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}
                          title={previewAudio?.id === music.id ? '정지' : '미리듣기'}
                        >
                          {previewAudio?.id === music.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>

                        {/* 편집 */}
                        {editingMusic?.id === music.id ? (
                          <>
                            <button
                              onClick={saveEditing}
                              className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full text-green-600 transition-colors"
                              title="저장"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingMusic(null)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors"
                              title="취소"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditing(music)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors"
                            title="편집"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* 삭제 */}
                        <button
                          onClick={() => {
                            setSelectedMusic(music);
                            setDeleteDialogOpen(true);
                          }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-red-600 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>음악 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 음악을 삭제하시겠습니까?
              <br />
              <strong>
                {selectedMusic?.displayTitle || selectedMusic?.title || selectedMusic?.originalName}
              </strong>
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMusic && deleteMutation.mutate(selectedMusic.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
