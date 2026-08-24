'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Package, Upload } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useMyBlogs } from '@/hooks/useBlogs';
import { useCreatePost } from '@/hooks/usePosts';
import ProductFileUpload from '@/components/marketplace/ProductFileUpload';
import type { UploadedDeliveryFile } from '@/components/marketplace/ProductFileUpload';
import { canAccessMarketplaceSellerTools } from '@/lib/marketplace-access';
import { hasPendingImageUpload } from '@/editor/utils/pending-image-upload';

// 에디터 동적 로드 (SSR 비활성화)
const BlogSimpleEditor = dynamic(
  () => import('@/editor').then((mod) => ({ default: mod.BlogSimpleEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 animate-pulse" />
    ),
  },
);

const CATEGORIES = [
  { value: 'ai_prompts', label: 'AI / 프롬프트' },
  { value: 'coding_templates', label: '개발 / 템플릿' },
  { value: 'tech_guides', label: '가이드 / 튜토리얼' },
  { value: 'data_analytics', label: '데이터 / 분석' },
  { value: 'others', label: '기타' },
  { value: '_custom', label: '직접 입력' },
] as const;

export default function NewProductPage() {
  const router = useRouter();
  const { user, authStatus, isAdmin } = useAuth();
  const { data: blogs, isLoading: isBlogsLoading } = useMyBlogs();
  const createPostMutation = useCreatePost();
  const canAccess = canAccessMarketplaceSellerTools(isAdmin);

  // 상품 정보
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [category, setCategory] = useState<string>('ai_prompts');
  const [customCategory, setCustomCategory] = useState('');

  // 콘텐츠
  const [descriptionContent, setDescriptionContent] = useState('');
  const [descriptionFileIds, setDescriptionFileIds] = useState<string[]>([]);
  const [isDescriptionImageUploading, setIsDescriptionImageUploading] = useState(false);
  const [deliveryFiles, setDeliveryFiles] = useState<UploadedDeliveryFile[]>([]);

  // 미리보기 설정
  const [previewMode, setPreviewMode] = useState<'auto' | 'custom'>('auto');
  const [customPreview, setCustomPreview] = useState('');

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  const blog = blogs ?? null;

  // 인증 체크
  useEffect(() => {
    if (authStatus !== 'loading' && !canAccess) {
      router.replace('/marketplace');
    }
  }, [authStatus, canAccess, router]);

  useEffect(() => {
    if (!isBlogsLoading && canAccess && user && !blog) {
      toast.error('블로그를 먼저 생성해주세요.');
      router.push('/');
    }
  }, [blog, canAccess, isBlogsLoading, user, router]);

  // 진행 상태 계산
  const hasTitle = title.trim().length > 0;
  const hasPrice = !!price && Number(price) >= 1000;
  const hasDescription = descriptionContent.trim().length > 0;
  const hasFiles = deliveryFiles.some((f) => f.status === 'ready');
  const completedSteps = [hasTitle, hasPrice, hasDescription, hasFiles].filter(Boolean).length;
  const isUploading = deliveryFiles.some(
    (f) => f.status === 'uploading' || f.status === 'confirming',
  );

  // 제출 핸들러
  const handleSubmit = async (asDraft = false) => {
    if (isSubmitting) return;

    if (!title.trim()) {
      toast.error('상품명을 입력해주세요');
      return;
    }
    if (!price || Number(price) < 1000) {
      toast.error('가격은 최소 1,000원 이상이어야 합니다');
      return;
    }
    if (!descriptionContent.trim()) {
      toast.error('상품 소개를 작성해주세요');
      return;
    }
    if (isUploading) {
      toast.error('파일 업로드가 진행 중입니다. 완료 후 다시 시도해주세요');
      return;
    }
    if (isDescriptionImageUploading || hasPendingImageUpload(descriptionContent)) {
      toast.error('상품 소개 이미지 업로드가 진행 중입니다. 완료 후 다시 시도해주세요');
      return;
    }
    if (!hasFiles) {
      toast.error('판매 파일을 최소 1개 이상 업로드해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const readyFiles = deliveryFiles.filter((f) => f.status === 'ready');
      const resolvedCategory = category === '_custom' ? (customCategory.trim() || 'others') : category;
      const postData: Record<string, unknown> = {
        title: title.trim(),
        content: descriptionContent,
        postType: 'product',
        category: resolvedCategory,
        productCategory: resolvedCategory,
        price: Number(price),
        deliveryFiles: readyFiles.map((f) => ({
          quarantineId: f.quarantineId,
          fileName: f.fileName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
        })),
        isPublished: !asDraft,
        attachedFileIds: descriptionFileIds,
        ...(previewMode === 'custom' && customPreview.trim()
          ? { previewContent: customPreview }
          : {}),
      };

      const result = await createPostMutation.mutateAsync(postData);
      toast.success(asDraft ? '초안이 저장되었습니다' : '상품이 등록되었습니다');

      if (asDraft) {
        router.push('/drafts');
      } else {
        router.push(`/marketplace/${(result as { slug: string }).slug}`);
      }
    } catch (error: unknown) {
      toast.error(
        (error as { message?: string })?.message || '상품 등록에 실패했습니다',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 상태
  if (authStatus === 'loading' || isBlogsLoading || !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0E141B]">
        <div className="w-8 h-8 border-2 border-gray-200 dark:border-zinc-700 border-t-gray-900 dark:border-t-zinc-100 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !blog || !canAccess) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0E141B]">
      {/* 에디터 스타일 오버라이드 — 상품 등록용 2행 툴바 + 배경 통일 */}
      <style jsx global>{`
        /* Spacer flex:1 무효화 → 좌측 정렬 */
        .product-editor .tiptap-toolbar > div[style*="flex"] {
          flex: 0 0 0px !important;
          width: 0 !important;
          overflow: hidden !important;
        }
        /* 툴바: 2행 wrap + 뚜렷한 배경 */
        .product-editor .tiptap-toolbar[data-variant="fixed"] {
          position: relative !important;
          overflow-x: visible !important;
          flex-wrap: wrap !important;
          height: auto !important;
          min-height: unset !important;
          padding: 0.375rem 0.5rem !important;
          gap: 0.25rem 0.5rem;
          background: #f3f4f6 !important;
          border-bottom: 1px solid #e5e7eb !important;
          justify-content: center !important;
        }
        .dark .product-editor .tiptap-toolbar[data-variant="fixed"] {
          background: #18181b !important;
          border-bottom-color: #27272a !important;
        }
        /* separator 숨김 → 그룹 간 gap으로 시각적 구분 */
        .product-editor .tiptap-separator {
          display: none !important;
        }
        /* Image/Video 텍스트 라벨 숨김 → 아이콘만 표시 */
        .product-editor .tiptap-button-text {
          display: none !important;
        }
        /* Undo/Redo 그룹 숨김 (Spacer 다음 첫 번째 그룹) */
        .product-editor .tiptap-toolbar > *:nth-child(2) {
          display: none !important;
        }
        .product-editor .tiptap-toolbar-group {
          flex-wrap: nowrap;
          flex-shrink: 0;
        }
        /* 모바일: 위치 오버라이드 (absolute 대신 relative 유지) */
        @media (max-width: 767px) {
          .product-editor .tiptap-toolbar[data-variant="fixed"] {
            position: relative !important;
            top: unset !important;
            bottom: unset !important;
            border-top: none !important;
            border-bottom: 1px solid #e5e7eb !important;
            height: auto !important;
          }
          .dark .product-editor .tiptap-toolbar[data-variant="fixed"] {
            border-bottom-color: #27272a !important;
          }
        }
        /* 에디터 래퍼 */
        .product-editor .simple-editor-wrapper {
          min-height: 280px;
        }
        /* 에디터 콘텐츠: gradient 제거 → 카드 배경과 일치 */
        .product-editor .simple-editor-content {
          background: #ffffff !important;
        }
        .dark .product-editor .simple-editor-content {
          background: transparent !important;
        }
        /* 에디터 내부 패딩: 카드 px-5와 정렬 */
        .product-editor .simple-editor-content .tiptap.ProseMirror.simple-editor {
          padding: 1.25rem !important;
        }
      `}</style>

      {/* 상단 내비게이션 */}
      <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#0E141B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            마켓플레이스
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* 페이지 타이틀 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            새 상품 등록
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            디지털 상품을 등록하고 판매를 시작하세요
          </p>
        </div>

        {/* 2-컬럼 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* ===== 좌측: 메인 콘텐츠 ===== */}
          <div className="space-y-6 min-w-0">
            {/* 상품명 */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                상품명
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="상품명을 입력하세요"
                className="w-full text-lg font-semibold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 bg-transparent border-none outline-none"
                maxLength={100}
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-xs ${title.length > 80 ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}
                >
                  {title.length}/100
                </span>
              </div>
            </div>

            {/* 상품 소개 (공개) */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    상품 소개
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 ml-6">
                  구매 전 모든 사용자에게 보이는 마케팅 설명입니다
                </p>
              </div>
              <div className="product-editor">
                <BlogSimpleEditor
                  content={descriptionContent}
                  onChange={setDescriptionContent}
                  onFileIdsChange={setDescriptionFileIds}
                  onUploadStateChange={({ isUploading: imageUploading }) => {
                    setIsDescriptionImageUploading(imageUploading);
                  }}
                  placeholder="상품의 특징과 가치를 설명해주세요..."
                />
              </div>
            </div>

            {/* 판매 파일 (구매자 전용) */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    판매 파일
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                    구매자 전용
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 ml-6">
                  구매 완료 후 다운로드할 수 있는 파일을 업로드하세요
                </p>
              </div>
              <ProductFileUpload
                files={deliveryFiles}
                onFilesChange={setDeliveryFiles}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* ===== 우측: 사이드바 ===== */}
          <div className="space-y-6">
            {/* 상품 정보 (카테고리 + 가격) */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  상품 정보
                </h3>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                  카테고리
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10 focus:border-gray-400 dark:focus:border-zinc-500 outline-none transition-colors"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {category === '_custom' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="카테고리를 직접 입력하세요"
                    maxLength={30}
                    className="w-full h-10 px-3 mt-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10 focus:border-gray-400 dark:focus:border-zinc-500 outline-none transition-colors"
                  />
                )}
              </div>

              {/* 가격 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                  가격
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-zinc-400">
                    ₩
                  </span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="최소 1,000"
                    min={1000}
                    className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10 focus:border-gray-400 dark:focus:border-zinc-500 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {price && Number(price) > 0 && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">
                    판매자 수익:{' '}
                    <span className="font-medium text-gray-700 dark:text-zinc-300">
                      ₩{Math.floor(Number(price) * 0.8).toLocaleString()}
                    </span>{' '}
                    (수수료 20%)
                  </p>
                )}
              </div>
            </div>

            {/* 미리보기 설정 */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                미리보기 설정
              </h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="previewMode"
                    checked={previewMode === 'auto'}
                    onChange={() => setPreviewMode('auto')}
                    className="accent-gray-900 dark:accent-zinc-100"
                  />
                  자동 추출 (소개 앞부분)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="previewMode"
                    checked={previewMode === 'custom'}
                    onChange={() => setPreviewMode('custom')}
                    className="accent-gray-900 dark:accent-zinc-100"
                  />
                  직접 작성
                </label>
              </div>
              {previewMode === 'custom' && (
                <textarea
                  value={customPreview}
                  onChange={(e) => setCustomPreview(e.target.value)}
                  placeholder="미구매자에게 보여줄 미리보기를 작성하세요..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 resize-none outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-zinc-100/10"
                />
              )}
            </div>

            {/* 진행 상태 + 액션 버튼 */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4 lg:sticky lg:top-6">
              {/* 진행 바 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                    작성 진행도
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {completedSteps}/4
                  </span>
                </div>
                <div className="flex gap-1">
                  {[hasTitle, hasPrice, hasDescription, hasFiles].map((done, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        done
                          ? 'bg-green-500 dark:bg-green-400'
                          : 'bg-gray-200 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
                  <span className={hasTitle ? 'text-green-600 dark:text-green-400' : ''}>
                    상품명
                  </span>
                  <span className={hasPrice ? 'text-green-600 dark:text-green-400' : ''}>
                    가격
                  </span>
                  <span className={hasDescription ? 'text-green-600 dark:text-green-400' : ''}>
                    소개
                  </span>
                  <span className={hasFiles ? 'text-green-600 dark:text-green-400' : ''}>
                    파일
                  </span>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="space-y-2">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting || isUploading || isDescriptionImageUploading}
                  className="w-full py-2.5 rounded-lg bg-gray-900 dark:bg-white text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? '등록 중...'
                    : isUploading || isDescriptionImageUploading
                      ? '업로드 진행 중...'
                      : '상품 등록'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting || isUploading || isDescriptionImageUploading}
                  className="w-full py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  초안 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
