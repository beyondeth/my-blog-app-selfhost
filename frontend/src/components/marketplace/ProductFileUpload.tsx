'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  CloudUpload,
  FileText,
  FileArchive,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  X,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  requestQuarantineUpload,
  uploadToS3WithProgress,
  confirmQuarantineUpload,
} from '@/services/api/marketplace-upload.service';

/** 업로드된 파일 상태 */
export interface UploadedDeliveryFile {
  id: string;
  quarantineId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'uploading' | 'confirming' | 'ready' | 'error';
  progress: number;
  errorMessage?: string;
}

interface ProductFileUploadProps {
  files: UploadedDeliveryFile[];
  onFilesChange: (files: UploadedDeliveryFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // bytes, default 100MB
  disabled?: boolean;
}

// 허용 MIME 타입
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/epub+zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-7z-compressed',
  'application/gzip',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
]);

// accept 속성용 확장자 문자열
const ACCEPT_EXTENSIONS =
  '.pdf,.epub,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.7z,.gz,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.csv,.json,.html';

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes('zip') || mimeType.includes('7z') || mimeType.includes('gzip'))
    return <FileArchive className="h-5 w-5 text-blue-500" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-green-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return <FileText className="h-5 w-5 text-blue-600" />;
  return <File className="h-5 w-5 text-gray-500 dark:text-zinc-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProductFileUpload({
  files,
  onFilesChange,
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024,
  disabled = false,
}: ProductFileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ref로 최신 파일 상태를 유지하여 병렬 업로드 간 race condition 방지
  const filesRef = useRef<UploadedDeliveryFile[]>(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // ref 기반 원자적 파일 상태 업데이트 (병렬 업로드 안전)
  const updateFileById = useCallback(
    (id: string, updates: Partial<UploadedDeliveryFile>) => {
      filesRef.current = filesRef.current.map((f) =>
        f.id === id ? { ...f, ...updates } : f,
      );
      onFilesChange([...filesRef.current]);
    },
    [onFilesChange],
  );

  // 개별 파일 업로드 플로우 (quarantine → S3 → confirm)
  const uploadSingleFile = useCallback(
    async (file: File, tempId: string) => {
      try {
        // 1단계: 격리 업로드 URL 발급
        const { uploadUrl, quarantineId } = await requestQuarantineUpload({
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        updateFileById(tempId, { quarantineId });

        // 2단계: S3 presigned URL로 직접 업로드
        await uploadToS3WithProgress(file, uploadUrl, (percent) => {
          updateFileById(tempId, { progress: percent });
        });

        // 3단계: 업로드 확인 (magic bytes 검증)
        updateFileById(tempId, { status: 'confirming', progress: 100 });

        await confirmQuarantineUpload(quarantineId);

        updateFileById(tempId, { status: 'ready' });
      } catch (error) {
        const message = error instanceof Error ? error.message : '업로드 실패';
        updateFileById(tempId, { status: 'error', errorMessage: message });
      }
    },
    [updateFileById],
  );

  // 복수 파일 처리
  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const newFiles: UploadedDeliveryFile[] = [];
      const filesToUpload: { file: File; tempId: string }[] = [];

      for (const file of Array.from(fileList)) {
        if (files.length + newFiles.length >= maxFiles) break;

        if (!ALLOWED_MIMES.has(file.type)) continue;
        if (file.size > maxFileSize) continue;

        const tempId = crypto.randomUUID();
        newFiles.push({
          id: tempId,
          quarantineId: '',
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          status: 'uploading',
          progress: 0,
        });
        filesToUpload.push({ file, tempId });
      }

      if (newFiles.length === 0) return;

      // ref와 parent 모두 업데이트
      const updatedFiles = [...files, ...newFiles];
      filesRef.current = updatedFiles;
      onFilesChange(updatedFiles);

      // 각 파일 독립적으로 병렬 업로드 (ref 기반이므로 race condition 없음)
      await Promise.allSettled(
        filesToUpload.map(({ file, tempId }) => uploadSingleFile(file, tempId)),
      );
    },
    [files, maxFiles, maxFileSize, onFilesChange, uploadSingleFile],
  );

  const handleRemove = useCallback(
    (fileId: string) => {
      filesRef.current = filesRef.current.filter((f) => f.id !== fileId);
      onFilesChange([...filesRef.current]);
    },
    [onFilesChange],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles],
  );

  return (
    <div className="space-y-3">
      {/* 드래그&드롭 존 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
          ${
            dragOver
              ? 'border-gray-400 bg-gray-50 dark:border-zinc-500 dark:bg-zinc-800/50'
              : 'border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_EXTENSIONS}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-gray-100 dark:bg-zinc-800 p-3">
            <CloudUpload className="h-6 w-6 text-gray-500 dark:text-zinc-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              파일을 드래그하거나{' '}
              <span className="text-gray-900 dark:text-white underline underline-offset-2">클릭하여 선택</span>
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              PDF, ZIP, EPUB, DOCX, 이미지 등 · 최대 100MB · 최대 {maxFiles}개
            </p>
          </div>
        </div>
      </div>

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={`
                flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors
                ${
                  file.status === 'error'
                    ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10'
                    : file.status === 'ready'
                      ? 'border-green-200 bg-green-50/30 dark:border-green-900/40 dark:bg-green-900/10'
                      : 'border-gray-200 bg-gray-50/50 dark:border-zinc-700 dark:bg-zinc-800/50'
                }
              `}
            >
              {/* 파일 아이콘 */}
              <div className="flex-shrink-0">{getFileIcon(file.mimeType)}</div>

              {/* 파일 정보 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    {formatFileSize(file.fileSize)}
                  </span>
                  {file.status === 'uploading' && (
                    <span className="text-xs text-blue-500">{file.progress}%</span>
                  )}
                  {file.status === 'confirming' && (
                    <span className="text-xs text-blue-500">검증 중...</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-xs text-red-500">{file.errorMessage}</span>
                  )}
                </div>
                {/* 업로드 진행 바 */}
                {(file.status === 'uploading' || file.status === 'confirming') && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* 상태 아이콘 / 삭제 버튼 */}
              <div className="flex-shrink-0">
                {file.status === 'uploading' || file.status === 'confirming' ? (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                ) : file.status === 'ready' ? (
                  <div className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-green-500" />
                    <button
                      type="button"
                      onClick={() => handleRemove(file.id)}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
                    </button>
                  </div>
                ) : file.status === 'error' ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <button
                      type="button"
                      onClick={() => handleRemove(file.id)}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
