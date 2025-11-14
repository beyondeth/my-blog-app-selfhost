"use client";

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export type ReportType = 'post' | 'comment' | 'user';

export type ReportReason = 
  | 'spam'
  | 'hate_speech'
  | 'inappropriate_content'
  | 'harassment'
  | 'copyright_violation'
  | 'misinformation'
  | 'other';

export interface CreateReportDto {
  type: ReportType;
  reason: ReportReason;
  description?: string;
  targetId: string;
}

export interface Report {
  id: string;
  type: ReportType;
  reason: ReportReason;
  description?: string;
  targetId: string;
  status: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export function useReport() {
  const queryClient = useQueryClient();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: ReportType;
    targetId: string;
    targetTitle?: string;
  } | null>(null);

  const createReportMutation = useMutation({
    mutationFn: async (data: CreateReportDto) => {
      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error('이미 신고한 콘텐츠입니다.');
        }
        throw new Error(error.message || '신고 처리 중 오류가 발생했습니다.');
      }

      return response.json();
    },
  });

  // 성공 처리
  React.useEffect(() => {
    if (createReportMutation.isSuccess) {
      toast.success('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
      setIsReportModalOpen(false);
      setReportTarget(null);
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
    }
  }, [createReportMutation.isSuccess, queryClient]);

  // 에러 처리
  React.useEffect(() => {
    if (createReportMutation.isError && createReportMutation.error) {
      const error = createReportMutation.error as Error;
      toast.error(error.message);
    }
  }, [createReportMutation.isError, createReportMutation.error]);

  const openReportModal = (type: ReportType, targetId: string, targetTitle?: string) => {
    setReportTarget({ type, targetId, targetTitle });
    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setIsReportModalOpen(false);
    setReportTarget(null);
  };

  const submitReport = async (reason: ReportReason, description?: string) => {
    if (!reportTarget) return;

    await createReportMutation.mutateAsync({
      type: reportTarget.type,
      targetId: reportTarget.targetId,
      reason,
      description,
    });
  };

  return {
    isReportModalOpen,
    reportTarget,
    openReportModal,
    closeReportModal,
    submitReport,
    isSubmitting: createReportMutation.isPending,
  };
}

export const reportReasonLabels: Record<ReportReason, string> = {
  spam: '스팸',
  hate_speech: '혐오 발언',
  inappropriate_content: '부적절한 콘텐츠',
  harassment: '괴롭힘',
  copyright_violation: '저작권 침해',
  misinformation: '잘못된 정보',
  other: '기타',
};