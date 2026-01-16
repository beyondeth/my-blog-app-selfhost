'use client';

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Calendar, Shield, X, LogIn } from 'lucide-react';
import { useVerifyAdult } from '@/hooks/adult-verification';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMobileOverlayReset } from '@/hooks/useMobileOverlayReset';

/**
 * AdultVerificationModal Props
 */
interface AdultVerificationModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 인증 성공 콜백 */
  onVerified?: () => void;
  /** 모달 제목 (기본값: 성인 인증 필요) */
  title?: string;
  /** 안내 메시지 */
  description?: string;
  /** 로그인 요구 여부 */
  requiresLogin?: boolean;
  /** 로그인 이동 핸들러 */
  onLogin?: () => void;
  /** 로그인 안내 메시지 */
  loginDescription?: string;
  /** 로그인 CTA 레이블 */
  loginButtonLabel?: string;
}

/**
 * 성인 인증 모달 컴포넌트
 *
 * @description 생년월일 입력을 통한 성인 인증 UI
 *
 * **특징:**
 * - 생년월일 드롭다운 선택 (년/월/일)
 * - 만 18세 이상 확인
 * - NSFW 커뮤니티 접근 시 사용
 *
 * @example
 * ```tsx
 * <AdultVerificationModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onVerified={() => {
 *     toast.success('인증 완료');
 *     router.push('/c/nsfw-community');
 *   }}
 * />
 * ```
 */
export default function AdultVerificationModal({
  isOpen,
  onClose,
  onVerified,
  title = '성인 인증 필요',
  description = '이 커뮤니티는 성인 전용입니다. 접근하려면 생년월일을 입력하여 본인이 만 18세 이상임을 확인해주세요.',
  requiresLogin = false,
  onLogin,
  loginDescription = '로그인 후 성인 인증을 진행하고 NSFW 커뮤니티를 이용할 수 있습니다.',
  loginButtonLabel = '로그인하기',
}: AdultVerificationModalProps) {
  // 생년월일 상태 (년, 월, 일 분리)
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [day, setDay] = useState<string>('');

  // 성인 인증 훅
  const { verifyAdult, isPending } = useVerifyAdult();
  useMobileOverlayReset(onClose, isOpen);

  // 유효성 검사
  const isValidDate = useCallback(() => {
    if (!year || !month || !day) return false;

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    // 기본 유효성 검사
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;

    // 월별 일수 검사
    const daysInMonth = new Date(y, m, 0).getDate();
    if (d > daysInMonth) return false;

    // 미래 날짜 검사
    const inputDate = new Date(y, m - 1, d);
    if (inputDate > new Date()) return false;

    return true;
  }, [year, month, day]);

  // 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requiresLogin) {
      toast.error('로그인 후 성인 인증을 진행할 수 있습니다.');
      onLogin?.();
      return;
    }

    if (!isValidDate()) {
      toast.error('올바른 생년월일을 입력해주세요.');
      return;
    }

    // YYYY-MM-DD 형식으로 변환
    const birthdate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    try {
      const result = await verifyAdult({ birthdate });

      if (result.verified) {
        toast.success(result.message);
        onVerified?.();
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '인증 중 오류가 발생했습니다.');
    }
  };

  // 년도 옵션 생성 (현재년도부터 100년 전까지)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: 100 },
    (_, i) => currentYear - i
  );

  // 월 옵션 (1-12)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // 일 옵션 (1-31)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        {requiresLogin ? (
          <div className="p-6 space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {loginDescription}
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-left space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p className="font-medium text-gray-700 dark:text-gray-100">진행 순서</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>로그인을 완료합니다.</li>
                <li>성인 인증을 진행해 NSFW 커뮤니티 사용이 가능해집니다.</li>
                <li>인증 내역은 계정 설정에서 확인할 수 있습니다.</li>
              </ol>
            </div>

            <Button
              type="button"
              onClick={() => {
                onLogin?.();
              }}
              className="w-full h-12 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white"
            >
              <LogIn className="w-4 h-4" />
              {loginButtonLabel}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              나중에 할게요
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 안내 메시지 */}
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {description}
            </p>

            {/* 생년월일 입력 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar className="w-4 h-4" />
                생년월일
              </label>

              <div className="flex gap-2">
                {/* 년도 */}
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={cn(
                    'flex-1 h-10 px-3 rounded-lg border',
                    'bg-white dark:bg-gray-800',
                    'border-gray-300 dark:border-gray-700',
                    'text-gray-900 dark:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-red-500'
                  )}
                  disabled={isPending}
                >
                  <option value="">년도</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>

                {/* 월 */}
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className={cn(
                    'w-24 h-10 px-3 rounded-lg border',
                    'bg-white dark:bg-gray-800',
                    'border-gray-300 dark:border-gray-700',
                    'text-gray-900 dark:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-red-500'
                  )}
                  disabled={isPending}
                >
                  <option value="">월</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>

                {/* 일 */}
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={cn(
                    'w-24 h-10 px-3 rounded-lg border',
                    'bg-white dark:bg-gray-800',
                    'border-gray-300 dark:border-gray-700',
                    'text-gray-900 dark:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-red-500'
                  )}
                  disabled={isPending}
                >
                  <option value="">일</option>
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 주의사항 */}
            <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Shield className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                입력하신 생년월일은 성인 인증 용도로만 사용되며,
                허위 정보 입력 시 서비스 이용이 제한될 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={!isValidDate() || isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    확인 중...
                  </div>
                ) : (
                  '인증하기'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
