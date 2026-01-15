'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  verifyAdult,
  getAdultVerificationStatus,
  AdultVerificationStatus,
  VerifyAdultResponse,
} from '@/services/api/adult-verification.service';
import { useAuth } from '@/providers/AuthProviderV2';

/**
 * 성인 인증 Query Key
 */
export const adultVerificationQueryKeys = {
  status: ['adult-verification', 'status'] as const,
};

/**
 * 성인 인증 상태 조회 훅
 *
 * @description 현재 사용자의 성인 인증 상태를 조회
 *
 * @example
 * ```tsx
 * const { isAdultVerified, isLoading } = useAdultVerificationStatus();
 *
 * if (isAdultVerified) {
 *   // NSFW 콘텐츠 표시
 * }
 * ```
 */
export function useAdultVerificationStatus() {
  const { isAuthenticated } = useAuth();

  const query = useQuery<AdultVerificationStatus>({
    queryKey: adultVerificationQueryKeys.status,
    queryFn: getAdultVerificationStatus,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5분 캐시
    gcTime: 30 * 60 * 1000, // 30분 유지
  });

  return {
    isAdultVerified: query.data?.isAdultVerified ?? false,
    verifiedAt: query.data?.verifiedAt,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 성인 인증 요청 훅
 *
 * @description 생년월일을 입력받아 성인 인증을 수행
 *
 * @example
 * ```tsx
 * const { verifyAdult, isPending, isSuccess, error } = useVerifyAdult();
 *
 * const handleSubmit = async (birthdate: string) => {
 *   const result = await verifyAdult({ birthdate });
 *   if (result.verified) {
 *     toast.success('성인 인증이 완료되었습니다.');
 *   } else {
 *     toast.error(result.message);
 *   }
 * };
 * ```
 */
export function useVerifyAdult() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    VerifyAdultResponse,
    Error,
    { birthdate: string }
  >({
    mutationFn: verifyAdult,
    onSuccess: (data) => {
      // 인증 성공 시 상태 캐시 업데이트
      if (data.verified) {
        queryClient.setQueryData<AdultVerificationStatus>(
          adultVerificationQueryKeys.status,
          {
            isAdultVerified: true,
            verifiedAt: data.verifiedAt,
          },
        );
      }
    },
  });

  return {
    verifyAdult: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
