'use client';

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { FiUpload, FiX, FiCheck, FiDroplet, FiImage, FiSquare, FiType } from 'react-icons/fi';
import { useUploadFile } from '@/hooks/useFiles';
import { FileType, Blog } from '@/types';
import { cn } from '@/lib/utils';
import TintedImagePreview from './TintedImagePreview';
import ImageCropperModal from '@/components/ui/ImageCropperModal';
import {
  SETTINGS_BUTTON_BASE_CLASS,
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_UPLOAD_BUTTON_CLASS,
} from '@/app/settings/theme';
import { DESTRUCTIVE_ACTION_CLASS, DESTRUCTIVE_BORDER_CLASS } from '@/constants/accessibility';
import { Switch } from '@/components/ui/switch';

const ICON_TEXT_INPUT_CLASS =
  typeof SETTINGS_INPUT_CLASS !== 'undefined'
    ? SETTINGS_INPUT_CLASS
    : 'w-full px-4 py-2.5 min-h-[46px] border border-gray-200 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e0e7ff] transition-all';

/**
 * BlogBrandingSettings Props
 */
interface BlogBrandingSettingsProps {
  /** 블로그 정보 */
  blog: Blog;
  /** 블로그 정보 새로고침 */
  onRefresh: () => Promise<void>;
}

/**
 * 브랜딩 필드 타입
 */
type BrandingField = 'logoUrl' | 'iconUrl' | 'coverImageUrl';

type ImageFitMode = 'cover' | 'contain';
type ImageFitField = 'logoImageFit' | 'iconImageFit' | 'coverImageFit';
type FeedbackKind = 'success' | 'error' | 'info';
type FeedbackPayload = { type: FeedbackKind; text: string } | null;
type BrandingFeedback = Record<
  BrandingField | 'color' | 'iconPlacement' | 'iconText',
  FeedbackPayload
>;

/**
 * 브랜딩 필드 설정
 */
const brandingFieldConfig: Record<BrandingField, {
  label: string;
  description: string;
  recommendedSize: string;
  aspectRatio: string;
  previewClass: string;
  minHeightClass?: string;
  roundedClass: string;
  defaultImageFit: ImageFitMode;
  imageSizes: string;
  allowFitToggle?: boolean;
  fitField: ImageFitField;
  icon: ReactNode;
  cropAspectRatio: number;
}> = {
  logoUrl: {
    label: '블로그 로고 (프로필카드)',
    description: '프로필 카드 상단 배경에 사용됩니다.',
    recommendedSize: '권장 최소 320x240px (4:3 비율 이상)',
    aspectRatio: '',
    previewClass: 'w-full max-w-[260px] h-60',
    minHeightClass: 'min-h-[220px]',
    roundedClass: 'rounded-xl',
    defaultImageFit: 'contain',
    imageSizes: '220px',
    allowFitToggle: true,
    fitField: 'logoImageFit',
    icon: <FiType className="w-4 h-4" />,
    cropAspectRatio: 4 / 3,
  },
  iconUrl: {
    label: '블로그 아이콘',
    description: '파비콘 및 목록 썸네일에 사용',
    recommendedSize: '64x64px (정사각형)',
    aspectRatio: 'aspect-square',
    previewClass: 'w-32 h-32',
    roundedClass: 'rounded-2xl',
    defaultImageFit: 'contain',
    imageSizes: '96px',
    allowFitToggle: true,
    fitField: 'iconImageFit',
    icon: <FiSquare className="w-4 h-4" />,
    cropAspectRatio: 1,
  },
  coverImageUrl: {
    label: '커버 이미지',
    description: '블로그 홈페이지 헤더 배경',
    recommendedSize: '1200x400px',
    aspectRatio: 'aspect-[3/1]',
    previewClass: 'w-full h-44',
    roundedClass: 'rounded-2xl',
    defaultImageFit: 'cover',
    imageSizes: '768px',
    allowFitToggle: true,
    fitField: 'coverImageFit',
    icon: <FiImage className="w-4 h-4" />,
    cropAspectRatio: 3 / 1,
  },
};

const buildPreviewModes = (
  logoFit?: ImageFitMode,
  iconFit?: ImageFitMode,
  coverFit?: ImageFitMode
): Record<BrandingField, ImageFitMode> => ({
  logoUrl: logoFit ?? brandingFieldConfig.logoUrl.defaultImageFit,
  iconUrl: iconFit ?? brandingFieldConfig.iconUrl.defaultImageFit,
  coverImageUrl: coverFit ?? brandingFieldConfig.coverImageUrl.defaultImageFit,
});

/**
 * 블로그 브랜딩 설정 컴포넌트
 *
 * @description
 * 블로그의 브랜딩 요소(로고, 아이콘, 커버 이미지, 브랜드 색상)를 설정하는 UI입니다.
 *
 * **특징:**
 * - 이미지 업로드 (WebP 자동 변환)
 * - 브랜드 색상 선택기
 * - 실시간 미리보기
 *
 * @example
 * ```tsx
 * <BlogBrandingSettings
 *   blog={blog}
 *   onRefresh={() => refreshBlog()}
 * />
 * ```
 */
export default function BlogBrandingSettings({
  blog,
  onRefresh,
}: BlogBrandingSettingsProps) {
  const FALLBACK_COLOR = '#000000';
  const { logoImageFit, iconImageFit, coverImageFit } = blog;
  const persistedBrandColor = blog.brandColor ?? null;
  const [brandColor, setBrandColor] = useState<string | null>(persistedBrandColor);
  const [isColorSaving, setIsColorSaving] = useState(false);
  const [colorSuccess, setColorSuccess] = useState(false);
  const [iconPlacement, setIconPlacement] = useState<'inline' | 'badge'>(blog.iconPlacement ?? 'inline');
  const [isIconPlacementSaving, setIsIconPlacementSaving] = useState(false);
  const [iconTextForm, setIconTextForm] = useState({
    textEnabled: blog.iconTextEnabled ?? true,
    labelEnabled: blog.iconLabelEnabled ?? true,
    subtitleEnabled: blog.iconSubtitleEnabled ?? true,
    label: blog.iconLabel ?? '',
    subtitle: blog.iconSubtitle ?? '',
  });
  const [iconTextSaving, setIconTextSaving] = useState(false);
  const [iconTextSuccess, setIconTextSuccess] = useState(false);

  // 업로드 상태
  const [uploadingField, setUploadingField] = useState<BrandingField | null>(null);

  // 크롭 상태
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [croppingField, setCroppingField] = useState<BrandingField | null>(null);

  // 파일 업로드 훅
  const uploadFileMutation = useUploadFile();

  // 파일 입력 참조
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [previewModes, setPreviewModes] = useState<Record<BrandingField, ImageFitMode>>(() =>
    buildPreviewModes(logoImageFit, iconImageFit, coverImageFit)
  );
  const [fitSavingField, setFitSavingField] = useState<ImageFitField | null>(null);
  const initialFeedbackState: BrandingFeedback = {
    coverImageUrl: null,
    iconUrl: null,
    logoUrl: null,
    color: null,
    iconPlacement: null,
    iconText: null,
  };
  const [feedbackMessages, setFeedbackMessages] = useState<BrandingFeedback>(initialFeedbackState);
  const setFeedbackMessage = useCallback(
    (key: BrandingField | 'color' | 'iconPlacement' | 'iconText', message: FeedbackPayload) => {
      setFeedbackMessages((prev) => ({
        ...prev,
        [key]: message,
      }));
    },
    []
  );

  // blog prop 변경 시 brandColor 동기화
  useEffect(() => {
    setBrandColor(persistedBrandColor);
  }, [persistedBrandColor]);

  useEffect(() => {
    setIconPlacement(blog.iconPlacement ?? 'inline');
  }, [blog.iconPlacement]);

  useEffect(() => {
    setIconTextForm({
      textEnabled: blog.iconTextEnabled ?? true,
      labelEnabled: blog.iconLabelEnabled ?? true,
      subtitleEnabled: blog.iconSubtitleEnabled ?? true,
      label: blog.iconLabel ?? '',
      subtitle: blog.iconSubtitle ?? '',
    });
  }, [
    blog.iconTextEnabled,
    blog.iconLabelEnabled,
    blog.iconSubtitleEnabled,
    blog.iconLabel,
    blog.iconSubtitle,
  ]);

  useEffect(() => {
    setPreviewModes(buildPreviewModes(logoImageFit, iconImageFit, coverImageFit));
  }, [logoImageFit, iconImageFit, coverImageFit]);

  /**
   * 블로그 브랜딩 업데이트 API 호출
   */
type BrandingUpdatePayload = {
  logoUrl: string | null;
  iconUrl: string | null;
  coverImageUrl: string | null;
  brandColor: string | null;
  logoImageFit: ImageFitMode;
  iconImageFit: ImageFitMode;
  coverImageFit: ImageFitMode;
  iconPlacement: 'inline' | 'badge';
  iconTextEnabled: boolean;
  iconLabelEnabled: boolean;
  iconSubtitleEnabled: boolean;
  iconLabel: string | null;
  iconSubtitle: string | null;
};

  const updateBranding = useCallback(async (data: Partial<BrandingUpdatePayload>) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/${blog.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '브랜딩 업데이트에 실패했습니다.');
    }

    return response.json();
  }, [blog.id]);

  /**
   * 이미지 업로드 핸들러
   */
  const handleImageUpload = useCallback(async (
    field: BrandingField,
    file: File
  ) => {
    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      setFeedbackMessage(field, { type: 'error', text: '이미지 파일만 업로드 가능합니다.' });
      return;
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setFeedbackMessage(field, { type: 'error', text: '파일 크기는 10MB 이하여야 합니다.' });
      return;
    }

    setUploadingField(field);

    try {
      // 파일 업로드 (WebP 자동 변환)
      const uploadedFile = await uploadFileMutation.mutateAsync({
        file,
        fileType: FileType.IMAGE,
      });

      // CDN URL로 브랜딩 업데이트
      await updateBranding({ [field]: uploadedFile.accessUrl || uploadedFile.fileUrl });

      setFeedbackMessage(field, { type: 'success', text: '이미지를 업로드했습니다.' });
      await onRefresh();
    } catch (error) {
      setFeedbackMessage(
        field,
        {
          type: 'error',
          text: error instanceof Error ? error.message : '업로드에 실패했습니다.',
        }
      );
    } finally {
      setUploadingField(null);
    }
  }, [setFeedbackMessage, uploadFileMutation, updateBranding, onRefresh]);

  /**
   * 이미지 삭제 핸들러
   */
  const handleImageRemove = useCallback(async (field: BrandingField) => {
    try {
      await updateBranding({ [field]: null });
      setPreviewModes((prev) => ({
        ...prev,
        [field]: brandingFieldConfig[field].defaultImageFit,
      }));
      setFeedbackMessage(field, { type: 'success', text: '이미지를 삭제했습니다.' });
      await onRefresh();
    } catch (error) {
      setFeedbackMessage(
        field,
        {
          type: 'error',
          text: error instanceof Error ? error.message : '삭제에 실패했습니다.',
        }
      );
    }
  }, [onRefresh, setFeedbackMessage, updateBranding]);

  /**
   * 파일 입력 참조 가져오기
   */
  const getInputRef = (field: BrandingField) => {
    switch (field) {
      case 'logoUrl': return logoInputRef;
      case 'iconUrl': return iconInputRef;
      case 'coverImageUrl': return coverInputRef;
    }
  };

  const handleImageFitChange = useCallback(
    async (field: BrandingField, nextMode: ImageFitMode) => {
      if (previewModes[field] === nextMode) return;
      const config = brandingFieldConfig[field];
      const fitField = config.fitField;
      const previousMode = previewModes[field];

      setPreviewModes((prev) => ({
        ...prev,
        [field]: nextMode,
      }));
      setFitSavingField(fitField);
      try {
        await updateBranding({ [fitField]: nextMode });
        const modeLabel = nextMode === 'cover' ? '화면에 맞춤' : '원본 비율';
        setFeedbackMessage(field, { type: 'success', text: `${modeLabel} 방식으로 업데이트했습니다.` });
        await onRefresh();
      } catch (error) {
        setFeedbackMessage(
          field,
          {
            type: 'error',
            text: error instanceof Error ? error.message : '표시 방식을 업데이트하지 못했습니다.',
          }
        );
        setPreviewModes((prev) => ({
          ...prev,
          [field]: previousMode,
        }));
      } finally {
        setFitSavingField(null);
      }
    },
    [onRefresh, previewModes, setFeedbackMessage, updateBranding]
  );

  /**
   * 브랜드 색상 저장 핸들러
   */
  const handleColorSave = useCallback(async () => {
    setIsColorSaving(true);
    setFeedbackMessage('color', { type: 'info', text: '저장 중...' });

    try {
      if (brandColor === null) {
        await updateBranding({ brandColor: null });
        setFeedbackMessage('color', { type: 'success', text: '브랜드 색상을 제거했습니다.' });
      } else {
        if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
          setFeedbackMessage('color', { type: 'error', text: '올바른 HEX 색상을 입력해주세요. (예: #FF5722)' });
          setIsColorSaving(false);
          return;
        }
        await updateBranding({ brandColor });
        setFeedbackMessage('color', { type: 'success', text: '브랜드 색상을 저장했습니다.' });
      }
      setColorSuccess(true);
      await onRefresh();
      setTimeout(() => setColorSuccess(false), 2000);
    } catch (error) {
      setFeedbackMessage(
        'color',
        {
          type: 'error',
          text: error instanceof Error ? error.message : '색상 저장에 실패했습니다.',
        }
      );
    } finally {
      setIsColorSaving(false);
    }
  }, [brandColor, onRefresh, setFeedbackMessage, updateBranding]);

  const handleColorReset = useCallback(() => {
    setBrandColor(null);
    setFeedbackMessage('color', { type: 'info', text: '브랜드 색상 없음 상태입니다. 저장을 눌러 확정하세요.' });
  }, [setFeedbackMessage]);

  const handleIconPlacementChange = useCallback(
    async (nextPlacement: 'inline' | 'badge') => {
      if (iconPlacement === nextPlacement) return;
      const previousPlacement = iconPlacement;
      setIconPlacement(nextPlacement);
      setIsIconPlacementSaving(true);
      setFeedbackMessage('iconPlacement', { type: 'info', text: '배치 저장 중...' });

      try {
        await updateBranding({ iconPlacement: nextPlacement });
        setFeedbackMessage('iconPlacement', { type: 'success', text: '아이콘 배치를 저장했습니다.' });
        await onRefresh();
      } catch (error) {
        setFeedbackMessage('iconPlacement', {
          type: 'error',
          text: error instanceof Error ? error.message : '아이콘 배치를 저장하지 못했습니다.',
        });
        setIconPlacement(previousPlacement);
      } finally {
        setIsIconPlacementSaving(false);
      }
    },
    [iconPlacement, onRefresh, setFeedbackMessage, updateBranding]
  );

  const handleIconTextSave = useCallback(async () => {
    if (iconTextSaving) return;
    setIconTextSaving(true);
    setIconTextSuccess(false);
    setFeedbackMessage('iconText', { type: 'info', text: '브랜드 텍스트를 저장하고 있습니다...' });

    try {
      await updateBranding({
        iconTextEnabled: iconTextForm.textEnabled,
        iconLabelEnabled: iconTextForm.labelEnabled,
        iconSubtitleEnabled: iconTextForm.subtitleEnabled,
        iconLabel: iconTextForm.label.trim() ? iconTextForm.label.trim() : null,
        iconSubtitle: iconTextForm.subtitle.trim() ? iconTextForm.subtitle.trim() : null,
      });
      setFeedbackMessage('iconText', { type: 'success', text: '브랜드 텍스트를 저장했습니다.' });
      setIconTextSuccess(true);
      setTimeout(() => setIconTextSuccess(false), 2000);
      await onRefresh();
    } catch (error) {
      setFeedbackMessage('iconText', {
        type: 'error',
        text: error instanceof Error ? error.message : '브랜드 텍스트를 저장하지 못했습니다.',
      });
    } finally {
      setIconTextSaving(false);
    }
  }, [iconTextForm, iconTextSaving, onRefresh, setFeedbackMessage, updateBranding]);

  // ----------------------------------------------------------------------
  // Handler for Image Cropping Flow
  // ----------------------------------------------------------------------
  const handleFileSelect = (field: BrandingField, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFeedbackMessage(field, { type: 'error', text: '이미지 파일만 선택 가능합니다.' });
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSelectedFile(reader.result as string);
        setCroppingField(field);
        setIsCropperOpen(true);
      });
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCropSave = async (croppedBlob: Blob) => {
    if (!croppingField) return;

    const file = new File([croppedBlob], "cropped-image.jpg", { type: "image/jpeg" });
    setIsCropperOpen(false); // 먼저 모달을 닫음
    await handleImageUpload(croppingField, file);
    setSelectedFile(null);
    setCroppingField(null);
  };

  /**
   * 이미지 업로드 영역 렌더링
   */
  const renderImageUploadArea = (field: BrandingField) => {
    const config = brandingFieldConfig[field];
    const currentUrl = blog[field];
    const isUploading = uploadingField === field;
    const inputRef = getInputRef(field);
    const displayHelper =
      previewModes[field] === 'cover'
        ? '이미지를 잘라서라도 영역 전체를 빈틈없이 채웁니다.'
        : '이미지 비율을 유지하고 여백은 배경색으로 자연스럽게 채웁니다.';

    const isCoverField = field === 'coverImageUrl';
    const coverTintGradient =
      isCoverField && brandColor
        ? `linear-gradient(135deg, ${brandColor}08 0%, transparent 32%)`
        : undefined;

    return (
      <div
        key={field}
        className={cn(SETTINGS_CARD_CLASS, 'p-5 space-y-5')}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white/10 dark:text-white">
              {config.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {config.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col items-center text-center">
            {currentUrl ? (
              <TintedImagePreview
                src={currentUrl}
                alt={config.label}
                className={cn('mx-auto', config.previewClass, config.aspectRatio)}
                roundedClassName={config.roundedClass}
                imageFit={previewModes[field]}
                imageSizes={config.imageSizes}
              >
                {isCoverField && brandColor && (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 opacity-[0.02]"
                    style={{ backgroundImage: coverTintGradient }}
                  />
                )}
              </TintedImagePreview>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300/80 bg-gray-50/80 p-6 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-100 dark:border-[#3A414F] dark:bg-[#1F2229] dark:text-gray-200 dark:hover:border-[#4A5060] dark:hover:bg-[#252b37]',
                  config.roundedClass,
                  config.aspectRatio,
                  config.previewClass,
                  config.minHeightClass || 'min-h-[120px]'
                )}
                style={
                  isCoverField && brandColor
                    ? {
                        backgroundImage: coverTintGradient,
                        borderColor: `${brandColor}0f`,
                      }
                    : undefined
                }
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    업로드 중...
                  </div>
                ) : (
                  <>
                    <FiUpload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                    <span className="text-center text-xs">
                      클릭해서 이미지 선택 (JPG·PNG·GIF·WebP, 10MB 이하)
                    </span>
                  </>
                )}
              </button>
            )}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              권장 {config.recommendedSize}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className={SETTINGS_UPLOAD_BUTTON_CLASS}
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <FiUpload className="h-4 w-4" />
                    {currentUrl ? '새 이미지 선택' : '이미지 업로드'}
                  </>
                )}
              </button>
              {currentUrl && (
                <button
                  type="button"
                  onClick={() => handleImageRemove(field)}
                  disabled={isUploading}
                  className={cn(
                    SETTINGS_BUTTON_BASE_CLASS,
                    DESTRUCTIVE_BORDER_CLASS,
                    DESTRUCTIVE_ACTION_CLASS
                  )}
                >
                  <FiX className="h-4 w-4" />
                  삭제
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">JPG·PNG·GIF·WebP / 최대 10MB</p>
              {config.allowFitToggle && currentUrl && (
                <>
                  <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-[#3A414F] dark:bg-[#1F2229]">
                    {(['cover', 'contain'] as ImageFitMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleImageFitChange(field, mode)}
                        className={cn(
                          'px-3 py-1 text-[12px] font-medium transition-colors',
                          'rounded-full',
                          previewModes[field] === mode
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        )}
                        disabled={config.fitField === fitSavingField}
                      >
                        {mode === 'cover' ? '화면에 맞춤' : '원본 비율'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{displayHelper}</p>
                </>
              )}
              {feedbackMessages[field] && (
                <p
                  className={cn(
                    'text-xs',
                    feedbackMessages[field]?.type === 'error'
                      ? 'text-red-500 dark:text-red-400'
                      : feedbackMessages[field]?.type === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {feedbackMessages[field]?.text}
                </p>
              )}
              {field === 'iconUrl' && (
                <div className="w-full rounded-2xl border border-gray-200/80 bg-gray-50/80 p-4 text-left dark:border-[#3A414F] dark:bg-[#1F2229]">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">아이콘 배치</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    브랜드 헤더에서 아이콘이 표시될 위치를 선택하세요.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      { value: 'inline' as const, title: '텍스트 옆', description: '제목 영역과 나란히 노출' },
                      { value: 'badge' as const, title: '커버 배지', description: '커버 하단에 배지로 겹쳐 표시' },
                    ].map(option => {
                      const isActive = iconPlacement === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleIconPlacementChange(option.value)}
                          disabled={isIconPlacementSaving}
                          className={cn(
                            'w-full rounded-xl border px-4 py-3 text-left transition',
                            'hover:border-gray-400 dark:hover:border-[#5B6173]',
                            isActive
                              ? 'border-gray-900 bg-gray-900/5 text-gray-900 dark:border-white dark:bg-white/10 dark:text-white'
                              : 'border-gray-200 text-gray-700 dark:border-[#3A414F] dark:text-gray-200'
                          )}
                        >
                          <p className="text-sm font-semibold">{option.title}</p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  {feedbackMessages.iconPlacement && (
                    <p
                      className={cn(
                        'mt-2 text-xs',
                        feedbackMessages.iconPlacement?.type === 'error'
                          ? 'text-red-500 dark:text-red-400'
                          : feedbackMessages.iconPlacement?.type === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {feedbackMessages.iconPlacement?.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 숨겨진 파일 입력 (크롭 핸들러 연동) */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(field, e)}
          className="hidden"
        />
      </div>
    );
  };

  const renderBrandColorCard = () => (
    <div className={cn(SETTINGS_CARD_CLASS, 'p-5 space-y-5')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white/10 dark:text-white">
            <FiDroplet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">브랜드 색상</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              블로그 테마에 사용되는 메인 컬러를 지정하세요.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          HEX
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative h-12 w-12">
            <input
              type="color"
              value={brandColor || FALLBACK_COLOR}
              onChange={(e) => {
                setFeedbackMessage('color', null);
                setBrandColor(e.target.value.toUpperCase());
              }}
              className={cn(
                'h-12 w-12 cursor-pointer rounded-2xl border-2 border-gray-300 bg-transparent p-0 dark:border-gray-700',
                brandColor === null && 'opacity-0'
              )}
              title="색상 선택"
            />
            {brandColor === null && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-gray-300 bg-white dark:border-gray-700 dark:bg-[#1F2229] flex items-center justify-center">
                <span className="w-6 h-0.5 bg-red-500 -rotate-45" />
              </div>
            )}
          </div>
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              #
            </div>
            <input
              type="text"
              value={brandColor ? brandColor.replace('#', '') : ''}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                setFeedbackMessage('color', null);
                setBrandColor(value ? ('#' + value.toUpperCase()) : null);
              }}
              placeholder="000000"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-8 pr-3 font-mono text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-[#3A414F] dark:bg-[#1F2229] dark:text-gray-50 dark:focus:border-[#6D79FF]"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleColorSave}
          disabled={isColorSaving || colorSuccess}
          className={cn(SETTINGS_PRIMARY_BUTTON_CLASS, 'w-full sm:w-[84px]')}
        >
          {isColorSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : colorSuccess ? (
            '완료'
          ) : (
            '저장'
          )}
        </button>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          추천 팔레트
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            '#000000',
            '#3B82F6',
            '#10B981',
            '#F59E0B',
            '#EF4444',
            '#8B5CF6',
            '#EC4899',
            '#6366F1',
          ].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setFeedbackMessage('color', null);
                setBrandColor(color);
              }}
              className={cn(
                'h-9 w-9 rounded-full border-2 transition',
                brandColor === color
                  ? 'border-gray-900 dark:border-white scale-110'
                  : 'border-transparent hover:scale-110'
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          <button
            type="button"
            onClick={handleColorReset}
            className={cn(
              'relative h-9 w-9 rounded-full border-2 bg-white/80 dark:bg-[#1F2229] flex items-center justify-center transition hover:scale-105',
              brandColor === null ? 'border-red-400 scale-110' : 'border-red-300'
            )}
            title="색상 제거"
          >
            <span className="absolute inset-px rounded-full bg-white dark:bg-[#1F2229]" />
            <span className="relative w-3/4 h-0.5 bg-red-500 -rotate-45" />
          </button>
        </div>
      </div>
      {feedbackMessages.color && (
        <p
          className={cn(
            'text-xs',
            feedbackMessages.color?.type === 'error'
              ? 'text-red-500 dark:text-red-400'
              : feedbackMessages.color?.type === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 dark:text-gray-400'
          )}
        >
          {feedbackMessages.color?.text}
        </p>
      )}
    </div>
  );

  const renderIconTextCard = () => {
    const originalState = {
      textEnabled: blog.iconTextEnabled ?? true,
      labelEnabled: blog.iconLabelEnabled ?? true,
      subtitleEnabled: blog.iconSubtitleEnabled ?? true,
      label: blog.iconLabel ?? '',
      subtitle: blog.iconSubtitle ?? '',
    };

    const isIconTextDirty =
      iconTextForm.textEnabled !== originalState.textEnabled ||
      iconTextForm.labelEnabled !== originalState.labelEnabled ||
      iconTextForm.subtitleEnabled !== originalState.subtitleEnabled ||
      iconTextForm.label !== originalState.label ||
      iconTextForm.subtitle !== originalState.subtitle;

    const statusTone = iconTextSuccess
      ? 'text-emerald-600 dark:text-emerald-300'
      : iconTextSaving
        ? 'text-gray-500 dark:text-gray-400'
        : isIconTextDirty
          ? 'text-gray-600 dark:text-gray-300'
          : 'text-gray-400 dark:text-gray-500';
    const statusText = iconTextSuccess
      ? '브랜드 텍스트가 저장되었습니다.'
      : iconTextSaving
        ? '저장 중...'
        : isIconTextDirty
          ? '변경 사항이 있습니다.'
          : '최신 상태입니다.';

    return (
      <section className={`${SETTINGS_CARD_CLASS} p-6 space-y-5`}>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">브랜드 텍스트</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            헤더에 표시되는 라벨과 보조 문구를 관리하세요.
          </p>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">라벨</label>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>표시</span>
                  <Switch
                    checked={iconTextForm.labelEnabled}
                    onCheckedChange={(val) => setIconTextForm((prev) => ({ ...prev, labelEnabled: val }))}
                  />
                </div>
              </div>
              <input
                type="text"
                maxLength={120}
                disabled={!iconTextForm.textEnabled || !iconTextForm.labelEnabled || iconTextSaving}
                value={iconTextForm.label}
                onChange={(e) =>
                  setIconTextForm((prev) => ({ ...prev, label: e.target.value.slice(0, 120) }))
                }
                className={cn(
                  ICON_TEXT_INPUT_CLASS,
                  (!iconTextForm.textEnabled || !iconTextForm.labelEnabled) && 'opacity-60 cursor-not-allowed'
                )}
                placeholder="예: CREATOR BLOG"
              />
              <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>최대 120자</span>
                <span>{iconTextForm.label.length}/120</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">보조 문구</label>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>표시</span>
                  <Switch
                    checked={iconTextForm.subtitleEnabled}
                    onCheckedChange={(val) =>
                      setIconTextForm((prev) => ({ ...prev, subtitleEnabled: val }))
                    }
                  />
                </div>
              </div>
              <input
                type="text"
                maxLength={160}
                disabled={!iconTextForm.textEnabled || !iconTextForm.subtitleEnabled || iconTextSaving}
                value={iconTextForm.subtitle}
                onChange={(e) =>
                  setIconTextForm((prev) => ({ ...prev, subtitle: e.target.value.slice(0, 160) }))
                }
                className={cn(
                  ICON_TEXT_INPUT_CLASS,
                  (!iconTextForm.textEnabled || !iconTextForm.subtitleEnabled) && 'opacity-60 cursor-not-allowed'
                )}
                placeholder="예: @park1818"
              />
              <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>최대 160자</span>
                <span>{iconTextForm.subtitle.length}/160</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-[#2F3440] pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={`text-xs font-medium ${statusTone}`}>
            {statusText}
          </div>
          <button
            type="button"
            disabled={!isIconTextDirty || iconTextSaving}
            onClick={handleIconTextSave}
            className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
          >
            {iconTextSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              '변경 사항 저장'
            )}
          </button>
        </div>
        {feedbackMessages.iconText && (
          <p
            className={cn(
              'text-xs',
              feedbackMessages.iconText.type === 'error'
                ? 'text-red-600 dark:text-red-400'
                : feedbackMessages.iconText.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {feedbackMessages.iconText.text}
          </p>
        )}
      </section>
    );
  };

  return (
    <section className="space-y-6 pt-1">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">블로그 브랜딩</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          커버·아이콘·로고 자산과 브랜드 색상을 한 번에 설정하세요.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {renderImageUploadArea('coverImageUrl')}
          {renderBrandColorCard()}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {renderImageUploadArea('iconUrl')}
          {renderImageUploadArea('logoUrl')}
        </div>
        {renderIconTextCard()}
      </div>
      
      {/* 이미지 크롭 모달 */}
      {brandingFieldConfig && croppingField && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          onClose={() => {
            setIsCropperOpen(false);
            setSelectedFile(null);
            setCroppingField(null);
          }}
          imageSrc={selectedFile}
          aspectRatio={brandingFieldConfig[croppingField].cropAspectRatio}
          onCropComplete={handleCropSave}
          loading={uploadingField === croppingField}
        />
      )}
    </section>
  );
}
