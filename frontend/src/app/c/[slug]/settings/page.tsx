'use client';

import { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCommunity, useUpdateCommunity } from '@/hooks/community';
import { communityService } from '@/services/api/community.service';
import {
  Settings,
  Users,
  Globe,
  Lock,
  Shield,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import {
  JoinPolicy,
  type JoinPolicyType,
} from '@/types/community';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import { ApplicationManagementSection } from '@/components/community/settings/ApplicationManagementSection';
import { InviteManagementSection } from '@/components/community/settings/InviteManagementSection';
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
import AdultVerificationModal from '@/components/adult-verification/AdultVerificationModal';
import { useAdultVerificationStatus } from '@/hooks/adult-verification/useAdultVerification';
import TintedImagePreview from '@/components/settings/TintedImagePreview';
import { Switch } from '@/components/ui/switch';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
  SETTINGS_SECTION_DESCRIPTION_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
  SETTINGS_UPLOAD_BUTTON_CLASS,
  SETTINGS_BUTTON_BASE_CLASS,
} from '@/app/settings/theme';
import {
  DESTRUCTIVE_ACTION_CLASS,
  DESTRUCTIVE_BORDER_CLASS,
  DESTRUCTIVE_SURFACE_CLASS,
} from '@/constants/accessibility';
import ImageCropperModal from '@/components/ui/ImageCropperModal';

type ImageFitMode = 'cover' | 'contain';

type ToggleFeedback = { type: 'success' | 'error' | 'info'; text: string } | null;

interface CommunitySettingsPageProps {
  params: Promise<{ slug: string }>;
}

const communityPanelSurface = `${SETTINGS_CARD_CLASS} p-6`;

/**
 * 커뮤니티 설정 페이지 (/c/[slug]/settings)
 * MODERATOR 이상 권한 필요
 */
export default function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { slug } = use(params);
  const router = useRouter();

  // 커뮤니티 정보 조회
  const { data: community, isLoading, isError, refetch } = useCommunity(slug);
  const updateMutation = useUpdateCommunity(slug);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    joinPolicy: 'open' as JoinPolicyType,
    isPublic: true,
    isPostDiscoverable: true,
    isNsfw: false,
  });

  const [joinPolicyDraft, setJoinPolicyDraft] = useState<JoinPolicyType>(JoinPolicy.OPEN);
  const [joinPolicySaving, setJoinPolicySaving] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaveSuccess, setGeneralSaveSuccess] = useState(false);

  // 이미지 업로드 상태
  const [iconUploading, setIconUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  // 크롭퍼 상태
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [croppingField, setCroppingField] = useState<'icon' | 'banner' | null>(null);
  const [imageFitModes, setImageFitModes] = useState<{ icon: ImageFitMode; banner: ImageFitMode }>({
    icon: 'contain',
    banner: 'cover',
  });
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  type CommunityBrandingFeedback = { type: 'success' | 'error' | 'info'; text: string } | null;
  const [brandingFeedback, setBrandingFeedback] = useState<{ icon: CommunityBrandingFeedback; banner: CommunityBrandingFeedback }>({
    icon: null,
    banner: null,
  });
  const setBrandingFeedbackMessage = useCallback(
    (key: 'icon' | 'banner', payload: CommunityBrandingFeedback) => {
      setBrandingFeedback(prev => ({
        ...prev,
        [key]: payload,
      }));
    },
    []
  );

  // NSFW 토글 보조 상태
  const [pendingNsfwValue, setPendingNsfwValue] = useState<boolean | null>(null);
  const [isNsfwDialogOpen, setIsNsfwDialogOpen] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [visibilityFeedback, setVisibilityFeedback] = useState<ToggleFeedback>(null);
  const [postVisibilityFeedback, setPostVisibilityFeedback] = useState<ToggleFeedback>(null);
  const [nsfwFeedback, setNsfwFeedback] = useState<ToggleFeedback>(null);

  // 에러/성공 메시지
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { isAdultVerified } = useAdultVerificationStatus();
  const joinPolicyOptions = [
    {
      value: JoinPolicy.OPEN,
      label: 'Open',
      description: 'Anyone can join immediately.',
      icon: Globe,
      accent: 'text-green-500',
    },
    {
      value: JoinPolicy.RESTRICTED,
      label: 'Approval required',
      description: 'New members must be approved by the moderation team.',
      icon: Shield,
      accent: 'text-yellow-500',
    },
    {
      value: JoinPolicy.PRIVATE,
      label: 'Private',
      description: 'People can join only through an invite link.',
      icon: Lock,
      accent: 'text-red-500',
    },
  ];
  const isVisibilityLocked = formData.joinPolicy === JoinPolicy.PRIVATE;

  // 커뮤니티 데이터로 폼 초기화
  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name || '',
        description: community.description || '',
        joinPolicy: community.joinPolicy || JoinPolicy.OPEN,
        isPublic: community.isPublic !== false,
        isPostDiscoverable: community.isPostDiscoverable !== false,
        isNsfw: community.isNsfw || false,
      });
      setJoinPolicyDraft(community.joinPolicy || JoinPolicy.OPEN);
      setImageFitModes({
        icon: community.iconImageFit ?? 'contain',
        banner: community.bannerImageFit ?? 'cover',
      });
    }
  }, [community]);

  const handleGeneralSave = useCallback(async () => {
    if (!community) return;

    const payload: Partial<typeof formData> = {};
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError('Please enter a community name.');
      return;
    }

    if (trimmedName !== (community.name || '')) {
      payload.name = trimmedName;
    }
    if ((formData.description || '') !== (community.description || '')) {
      payload.description = formData.description;
    }

    if (Object.keys(payload).length === 0) return;

    setGeneralSaving(true);
    setError('');

    try {
      await updateMutation.mutateAsync(payload);
      await refetch();
      setGeneralSaveSuccess(true);
      setTimeout(() => setGeneralSaveSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update the basic information.');
    } finally {
      setGeneralSaving(false);
    }
  }, [community, formData.description, formData.name, refetch, updateMutation]);

  // 가입 정책 변경 핸들러 (즉시 저장)
  const handleJoinPolicySelect = useCallback((newPolicy: JoinPolicyType) => {
    setJoinPolicyDraft(newPolicy);
    setError('');
  }, []);

  const handleJoinPolicySave = useCallback(async () => {
    if (joinPolicyDraft === formData.joinPolicy) return;
    setJoinPolicySaving(true);
    setError('');
    try {
      await updateMutation.mutateAsync({ joinPolicy: joinPolicyDraft });
      await refetch();
      setFormData(prev => ({ ...prev, joinPolicy: joinPolicyDraft }));
      setSuccess('Join policy updated.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update the join policy.');
    } finally {
      setJoinPolicySaving(false);
    }
  }, [joinPolicyDraft, formData.joinPolicy, updateMutation, refetch]);

  // 공개 설정 변경 핸들러 (즉시 저장)
  const handlePublicChange = useCallback(async (newValue: boolean) => {
    if (formData.isPublic === newValue) return;
    setFormData((prev) => ({ ...prev, isPublic: newValue }));
    setError('');
    setVisibilityFeedback({ type: 'info', text: 'Saving your settings...' });

    try {
      await updateMutation.mutateAsync({ isPublic: newValue });
      await refetch();
      setVisibilityFeedback({
        type: 'success',
        text: newValue
          ? 'Community discovery in lists and search is enabled.'
          : 'Community discovery in lists and search is disabled.',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update discovery visibility.');
      // 롤백
      if (community) {
        setFormData((prev) => ({ ...prev, isPublic: community.isPublic }));
      }
      setVisibilityFeedback({
        type: 'error',
        text: err.message || 'Unable to update community discovery visibility.',
      });
    }
  }, [formData.isPublic, updateMutation, community, refetch]);

  const handlePostDiscoverableChange = useCallback(async (newValue: boolean) => {
    if (formData.isPostDiscoverable === newValue) return;
    setFormData((prev) => ({ ...prev, isPostDiscoverable: newValue }));
    setError('');
    setPostVisibilityFeedback({ type: 'info', text: 'Saving your settings...' });

    try {
      await updateMutation.mutateAsync({ isPostDiscoverable: newValue });
      await refetch();
      setPostVisibilityFeedback({
        type: 'success',
        text: newValue
          ? 'Community post discovery is enabled.'
          : 'Community post discovery is disabled.',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update post discovery.');
      if (community) {
        setFormData((prev) => ({
          ...prev,
          isPostDiscoverable: community.isPostDiscoverable !== false,
        }));
      }
      setPostVisibilityFeedback({
        type: 'error',
        text: err.message || 'Unable to update post discovery visibility.',
      });
    }
  }, [formData.isPostDiscoverable, updateMutation, community, refetch]);

  // NSFW 설정 변경 핸들러 (즉시 저장)
  const applyNsfwValue = useCallback(async (newValue: boolean) => {
    setFormData((prev) => ({ ...prev, isNsfw: newValue }));
    setError('');
    setNsfwFeedback({ type: 'info', text: 'Saving your settings...' });

    try {
      await updateMutation.mutateAsync({ isNsfw: newValue });
      await refetch();
      setNsfwFeedback({
        type: 'success',
        text: newValue ? 'The community is now marked as NSFW.' : 'The NSFW label has been removed.',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update the NSFW setting.');
      if (community) {
        setFormData((prev) => ({ ...prev, isNsfw: community.isNsfw }));
      }
      setNsfwFeedback({
        type: 'error',
        text: err.message || 'Unable to update the NSFW setting.',
      });
    }
  }, [updateMutation, community, refetch]);

  const handleNsfwChange = useCallback((newValue: boolean) => {
    if (formData.isNsfw === newValue) return;
    if (newValue) {
      setPendingNsfwValue(true);
      setIsNsfwDialogOpen(true);
      return;
    }
    applyNsfwValue(false);
  }, [formData.isNsfw, applyNsfwValue]);

  const handleConfirmNsfwChange = useCallback(async () => {
    if (pendingNsfwValue === null) return;
    setIsNsfwDialogOpen(false);
    await applyNsfwValue(pendingNsfwValue);
    setPendingNsfwValue(null);
  }, [pendingNsfwValue, applyNsfwValue]);

  const handleCancelNsfwChange = useCallback(() => {
    setPendingNsfwValue(null);
    setIsNsfwDialogOpen(false);
  }, []);

  const getDisplayHelperText = useCallback((mode: ImageFitMode) => {
    return mode === 'cover'
      ? 'Fills the entire frame, even if part of the image is cropped.'
      : 'Keeps the original aspect ratio and fills the empty space with the background color.';
  }, []);

  // 파일 선택 인터셉터
  const handleFileSelect = (field: 'icon' | 'banner', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
         setBrandingFeedbackMessage(field, { type: 'error', text: 'Please select an image file.' });
         return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setBrandingFeedbackMessage(field, { type: 'error', text: 'Files must be 10MB or smaller.' });
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

  // 실제 업로드 로직 (File 객체 직접 수신)
  const uploadIcon = useCallback(async (file: File) => {
    setIconUploading(true);
    setBrandingFeedbackMessage('icon', { type: 'info', text: 'Uploading icon...' });
    try {
      await communityService.uploadCommunityImage(slug, 'icon', file);
      await refetch();
      setBrandingFeedbackMessage('icon', { type: 'success', text: 'Icon uploaded.' });
    } catch (err: any) {
      setBrandingFeedbackMessage('icon', { type: 'error', text: err.message || 'Failed to upload the icon.' });
    } finally {
      setIconUploading(false);
    }
  }, [slug, refetch, setBrandingFeedbackMessage]);

  const uploadBanner = useCallback(async (file: File) => {
    setBannerUploading(true);
    setBrandingFeedbackMessage('banner', { type: 'info', text: 'Uploading banner...' });
    try {
      await communityService.uploadCommunityImage(slug, 'banner', file);
      await refetch();
      setBrandingFeedbackMessage('banner', { type: 'success', text: 'Banner uploaded.' });
    } catch (err: any) {
      setBrandingFeedbackMessage('banner', { type: 'error', text: err.message || 'Failed to upload the banner.' });
    } finally {
      setBannerUploading(false);
    }
  }, [slug, refetch, setBrandingFeedbackMessage]);

  // 크롭 완료 후 최종 업로드 호출
  const handleCropSave = async (croppedBlob: Blob) => {
    if (!croppingField) return;
    const fileName = croppingField === 'icon' ? 'community-icon.jpg' : 'community-banner.jpg';
    const file = new File([croppedBlob], fileName, { type: "image/jpeg" });
    
    setIsCropperOpen(false);
    if (croppingField === 'icon') {
      await uploadIcon(file);
    } else {
      await uploadBanner(file);
    }
    setSelectedFile(null);
    setCroppingField(null);
  };
  
  const handleIconRemove = useCallback(async () => {
    setIconUploading(true);
    setBrandingFeedbackMessage('icon', { type: 'info', text: 'Removing icon...' });
    try {
      await updateMutation.mutateAsync({ iconUrl: null });
      await refetch();
      setBrandingFeedbackMessage('icon', { type: 'success', text: 'Icon removed.' });
    } catch (err: any) {
      setBrandingFeedbackMessage('icon', { type: 'error', text: err?.message || 'Failed to remove the icon.' });
    } finally {
      setIconUploading(false);
    }
  }, [refetch, setBrandingFeedbackMessage, updateMutation]);

  const handleBannerRemove = useCallback(async () => {
    setBannerUploading(true);
    setBrandingFeedbackMessage('banner', { type: 'info', text: 'Removing banner...' });
    try {
      await updateMutation.mutateAsync({ bannerUrl: null });
      await refetch();
      setBrandingFeedbackMessage('banner', { type: 'success', text: 'Banner removed.' });
    } catch (err: any) {
      setBrandingFeedbackMessage('banner', { type: 'error', text: err?.message || 'Failed to remove the banner.' });
    } finally {
      setBannerUploading(false);
    }
  }, [refetch, setBrandingFeedbackMessage, updateMutation]);

  const handleImageFitChange = useCallback(
    async (target: 'icon' | 'banner', mode: ImageFitMode) => {
// ...
      if (imageFitModes[target] === mode) return;
      const previousMode = imageFitModes[target];
      setImageFitModes((prev) => ({
        ...prev,
        [target]: mode,
      }));
      setBrandingFeedbackMessage(target, { type: 'info', text: 'Saving display mode...' });
      const payload = target === 'icon' ? { iconImageFit: mode } : { bannerImageFit: mode };
      try {
        await updateMutation.mutateAsync(payload);
        await refetch();
        const label = mode === 'cover' ? 'Fill frame' : 'Keep aspect ratio';
        setBrandingFeedbackMessage(target, { type: 'success', text: `Updated to ${label.toLowerCase()}.` });
      } catch (err: any) {
        setImageFitModes((prev) => ({
          ...prev,
          [target]: previousMode,
        }));
        setBrandingFeedbackMessage(
          target,
          {
            type: 'error',
            text: err?.message || 'Unable to update the display mode.',
          }
        );
      }
    },
    [imageFitModes, refetch, setBrandingFeedbackMessage, updateMutation],
  );

  // 로딩 중이면 레이아웃에서 처리
  if (isLoading || !community) {
    return (
      <CommunityAdminLayout slug={slug}>
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-gray-200 dark:bg-white/10 rounded-xl" />
          <div className="h-48 bg-gray-200 dark:bg-white/10 rounded-xl" />
        </div>
      </CommunityAdminLayout>
    );
  }

  const originalName = community.name || '';
  const originalDescription = community.description || '';
  const isGeneralDirty =
    formData.name.trim() !== originalName ||
    formData.description !== originalDescription;

  return (
    <CommunityAdminLayout slug={slug}>
      <div className="space-y-6">
        {(error || success) && (
          <div className="space-y-3">
            {error && (
              <div className={cn('p-4 text-sm rounded-lg', DESTRUCTIVE_SURFACE_CLASS)}>
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-lg">
                {success}
              </div>
            )}
          </div>
        )}

        {/* 기본 정보 섹션 */}
        <section className={communityPanelSurface}>
          <div className="mb-6 space-y-1">
            <h2 className={`${SETTINGS_SECTION_TITLE_CLASS} flex items-center gap-2`}>
              <Settings className="w-5 h-5" />
              Basic information
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>Update the community name and description.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Community name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={50}
                placeholder="Community name"
                className={SETTINGS_INPUT_CLASS}
              />
              <p className="text-xs text-gray-500 dark:text-gray-300">2-50 characters. Letters, numbers, and spaces are allowed.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Community description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setFormData({ ...formData, description: e.target.value });
                  }
                }}
                rows={8}
                maxLength={500}
                placeholder="Introduce your community..."
                className={`${SETTINGS_INPUT_CLASS} min-h-[240px]`}
              />
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300">
                <span>{formData.description.length}/500</span>
                <span>This text appears in the community profile.</span>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/10 pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={`text-xs font-medium ${
                  generalSaveSuccess
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : generalSaving
                    ? 'text-gray-500 dark:text-gray-300'
                    : isGeneralDirty
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {generalSaveSuccess
                  ? 'Basic information saved.'
                  : generalSaving
                  ? 'Saving...'
                  : isGeneralDirty
                  ? 'You have unsaved changes.'
                  : 'Everything is up to date.'}
              </div>
              <button
                onClick={handleGeneralSave}
                disabled={!isGeneralDirty || generalSaving}
                className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
              >
                {generalSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </div>
        </section>

        {/* 브랜딩 섹션 */}
        <section className={communityPanelSurface}>
          <div className="mb-6 space-y-1">
            <h2 className={`${SETTINGS_SECTION_TITLE_CLASS} flex items-center gap-2`}>
              <ImageIcon className="w-5 h-5" />
              Branding
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>Replace the icon and banner, then adjust how each image is displayed.</p>
          </div>

          <div className="space-y-6">
            <div className={`${SETTINGS_CARD_CLASS} p-5 space-y-5`}>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Community icon</p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Shown on profiles and in community lists.</p>
              </div>
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex flex-1 flex-col items-center text-center">
                  {community.iconUrl ? (
                    <TintedImagePreview
                      src={community.iconUrl}
                      alt="Community icon"
                      className="mx-auto h-24 w-24"
                      roundedClassName="rounded-full"
                      imageFit={imageFitModes.icon}
                      imageSizes="96px"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      disabled={iconUploading}
                      className="flex w-full max-w-[220px] flex-col items-center justify-center gap-3 rounded-full border-2 border-dashed border-gray-300/80 bg-gray-50/80 p-6 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-100 dark:border-[#3A414F] dark:bg-[#1F2229] dark:text-gray-200 dark:hover:border-[#4A5060] dark:hover:bg-[#252b37]"
                    >
                      {iconUploading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                          Uploading...
                        </div>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                          <span className="text-center text-xs">
                            Click to choose an image (JPG, PNG, GIF, or WebP up to 10MB)
                          </span>
                        </>
                      )}
                    </button>
                  )}
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Recommended 150x150px
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      className={SETTINGS_UPLOAD_BUTTON_CLASS}
                      disabled={iconUploading}
                      onClick={() => iconInputRef.current?.click()}
                    >
                      {iconUploading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {iconUploading ? 'Uploading...' : 'Choose new image'}
                    </button>
                    {community.iconUrl && (
                      <button
                        type="button"
                        className={cn(
                          SETTINGS_BUTTON_BASE_CLASS,
                          DESTRUCTIVE_BORDER_CLASS,
                          DESTRUCTIVE_ACTION_CLASS
                        )}
                        disabled={iconUploading}
                        onClick={handleIconRemove}
                      >
                        <FiX className="h-4 w-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                    <p>JPG, PNG, GIF, or WebP / up to 10MB</p>
                    {community.iconUrl && (
                      <>
                        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-[#3A414F] dark:bg-[#1F2229]">
                        {(['cover', 'contain'] as ImageFitMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handleImageFitChange('icon', mode)}
                            className={cn(
                              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                              imageFitModes.icon === mode
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            )}
                            disabled={iconUploading}
                          >
                            {mode === 'cover' ? 'Fill frame' : 'Keep aspect ratio'}
                          </button>
                        ))}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-300">
                          {getDisplayHelperText(imageFitModes.icon)}
                        </p>
                      </>
                    )}
                    {brandingFeedback.icon && (
                      <p
                        className={cn(
                          'text-xs',
                          brandingFeedback.icon.type === 'error'
                            ? 'text-red-500 dark:text-red-400'
                            : brandingFeedback.icon.type === 'success'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-500 dark:text-gray-300'
                        )}
                      >
                        {brandingFeedback.icon.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect('icon', e)}
                disabled={iconUploading}
              />
            </div>

            <div className={`${SETTINGS_CARD_CLASS} p-5 space-y-5`}>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Community banner</p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Background image shown at the top of the community.</p>
              </div>
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex flex-1 flex-col items-center text-center">
                  {community.bannerUrl ? (
                    <TintedImagePreview
                      src={community.bannerUrl}
                      alt="Community banner"
                      className="mx-auto h-40 w-full"
                      roundedClassName="rounded-2xl"
                      imageFit={imageFitModes.banner}
                      imageSizes="768px"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={bannerUploading}
                      className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300/80 bg-gray-50/80 p-6 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-100 dark:border-[#3A414F] dark:bg-[#1F2229] dark:text-gray-200 dark:hover:border-[#4A5060] dark:hover:bg-[#252b37]"
                    >
                      {bannerUploading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                          Uploading...
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                          <span className="text-center text-xs">
                            Click to choose an image (JPG, PNG, GIF, or WebP up to 10MB)
                          </span>
                        </>
                      )}
                    </button>
                  )}
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Recommended 1200x300px
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      className={SETTINGS_UPLOAD_BUTTON_CLASS}
                      disabled={bannerUploading}
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      {bannerUploading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {bannerUploading ? 'Uploading...' : 'Choose new image'}
                    </button>
                    {community.bannerUrl && (
                      <button
                        type="button"
                        className={cn(
                          SETTINGS_BUTTON_BASE_CLASS,
                          DESTRUCTIVE_BORDER_CLASS,
                          DESTRUCTIVE_ACTION_CLASS
                        )}
                        disabled={bannerUploading}
                        onClick={handleBannerRemove}
                      >
                        <FiX className="h-4 w-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                    <p>JPG, PNG, GIF, or WebP / up to 10MB</p>
                    {community.bannerUrl && (
                      <>
                        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-[#3A414F] dark:bg-[#1F2229]">
                        {(['cover', 'contain'] as ImageFitMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handleImageFitChange('banner', mode)}
                            className={cn(
                              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                              imageFitModes.banner === mode
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            )}
                            disabled={bannerUploading}
                          >
                            {mode === 'cover' ? 'Fill frame' : 'Keep aspect ratio'}
                          </button>
                        ))}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-300">
                          {getDisplayHelperText(imageFitModes.banner)}
                        </p>
                      </>
                    )}
                    {brandingFeedback.banner && (
                      <p
                        className={cn(
                          'text-xs',
                          brandingFeedback.banner.type === 'error'
                            ? 'text-red-500 dark:text-red-400'
                            : brandingFeedback.banner.type === 'success'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-500 dark:text-gray-300'
                        )}
                      >
                        {brandingFeedback.banner.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect('banner', e)}
                disabled={bannerUploading}
              />
            </div>
          </div>
        </section>

        {/* 가입 정책 섹션 */}
        <section className={communityPanelSurface}>
          <div className="mb-6 space-y-1">
            <h2 className={`${SETTINGS_SECTION_TITLE_CLASS} flex items-center gap-2`}>
              <Users className="w-5 h-5" />
              Join policy
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>Choose how people join this community.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            {joinPolicyOptions.map(option => {
              const Icon = option.icon;
              const isActive = joinPolicyDraft === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleJoinPolicySelect(option.value)}
                  disabled={updateMutation.isPending}
                  aria-pressed={isActive}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    isActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', option.accent)} />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-300">
              Changes apply only after you click save.
            </p>
            <button
              type="button"
              onClick={handleJoinPolicySave}
              disabled={
                joinPolicySaving ||
                updateMutation.isPending ||
                joinPolicyDraft === formData.joinPolicy
              }
              className={`${SETTINGS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}
            >
              {joinPolicySaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>

        {/* 공개 설정 섹션 */}
        <section className={communityPanelSurface}>
          <div className="mb-6 space-y-1">
            <h2 className={`${SETTINGS_SECTION_TITLE_CLASS} flex items-center gap-2`}>
              <Globe className="w-5 h-5" />
              Visibility settings
            </h2>
            <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>Control discovery and NSFW labeling for this community.</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <label
                  htmlFor="isPublic"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Show community in lists and search
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                  The community appears in discovery lists and search results. When disabled, it is accessible only by direct link.
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={handlePublicChange}
                disabled={isVisibilityLocked}
              />
            </div>
            {visibilityFeedback && (
              <p
                className={cn(
                  'text-xs',
                  visibilityFeedback.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : visibilityFeedback.type === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-300'
                )}
              >
                {visibilityFeedback.text}
              </p>
            )}

            <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label
                  htmlFor="isPostDiscoverable"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Show posts across discovery surfaces
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                  Posts can appear on the home feed, in search, and in trending surfaces.
                </p>
              </div>
              <Switch
                id="isPostDiscoverable"
                checked={formData.isPostDiscoverable}
                onCheckedChange={handlePostDiscoverableChange}
                disabled={isVisibilityLocked}
              />
            </div>
            {postVisibilityFeedback && (
              <p
                className={cn(
                  'text-xs',
                  postVisibilityFeedback.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : postVisibilityFeedback.type === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-300'
                )}
              >
                {postVisibilityFeedback.text}
              </p>
            )}

            {isVisibilityLocked && (
              <p className="text-xs text-gray-500 dark:text-gray-300">
                Private communities are member-only, so discovery toggles are disabled.
              </p>
            )}

            <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label
                  htmlFor="isNsfw"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  NSFW (adult content)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                  Mark this community if it contains content intended for adults only.
                </p>
              </div>
              <Switch
                id="isNsfw"
                checked={formData.isNsfw}
                onCheckedChange={handleNsfwChange}
              />
            </div>
            {nsfwFeedback && (
              <p
                className={cn(
                  'text-xs',
                  nsfwFeedback.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : nsfwFeedback.type === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-300'
                )}
              >
                {nsfwFeedback.text}
              </p>
            )}
            {formData.isNsfw && !isAdultVerified && (
              <div className="rounded-lg border border-orange-200 dark:border-orange-700/60 bg-orange-50 dark:bg-orange-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  This community is now marked as NSFW. You will not be able to view it yourself until adult verification is complete.
                </p>
                <button
                  type="button"
                  onClick={() => setShowVerificationModal(true)}
                  className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-auto gap-2`}
                >
                  Verify age
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 가입 신청 관리 (RESTRICTED 커뮤니티만) */}
        {formData.joinPolicy === JoinPolicy.RESTRICTED && (
          <ApplicationManagementSection slug={slug} />
        )}

        {/* 초대 링크 관리 (RESTRICTED/PRIVATE 커뮤니티만) */}
        {(formData.joinPolicy === JoinPolicy.RESTRICTED ||
          formData.joinPolicy === JoinPolicy.PRIVATE) && (
          <InviteManagementSection slug={slug} />
        )}

      </div>
      <AlertDialog open={isNsfwDialogOpen} onOpenChange={setIsNsfwDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this community as NSFW?</AlertDialogTitle>
            <AlertDialogDescription>
              The community will be labeled as adult content. Until adult verification is complete, you will not be able to view it yourself. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelNsfwChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmNsfwChange}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdultVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onVerified={() => {
          setShowVerificationModal(false);
          setSuccess('Adult verification completed.');
          setTimeout(() => setSuccess(''), 2000);
        }}
        title="Adult verification required"
        description="You need age verification to manage an NSFW community."
      />
        {/* 크롭 모달 */}
        {croppingField && (
          <ImageCropperModal
            isOpen={isCropperOpen}
            onClose={() => {
              setIsCropperOpen(false);
              setSelectedFile(null);
              setCroppingField(null);
            }}
            imageSrc={selectedFile}
            aspectRatio={croppingField === 'icon' ? 1 : 4}
            onCropComplete={handleCropSave}
            loading={croppingField === 'icon' ? iconUploading : bannerUploading}
          />
        )}
    </CommunityAdminLayout>
  );
}
