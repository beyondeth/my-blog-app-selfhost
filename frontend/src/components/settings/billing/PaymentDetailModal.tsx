'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, CreditCard } from 'lucide-react';
import type { PaymentHistory } from '@/types/subscription';

/* ─────────── 유틸 ─────────── */

function formatAmount(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

/** 카드사 issuerCode → 이름 */
const CARD_ISSUER_MAP: Record<string, string> = {
  '3K': '기업BC', '46': '광주은행', '71': '롯데카드', '30': 'KDB산업은행',
  '31': 'BC카드', '51': '삼성카드', '38': '새마을금고', '41': '신한카드',
  '62': '신협', '36': '씨티카드', '33': '우리BC카드', 'W1': '우리카드',
  '37': '우체국예금보험', '39': '저축은행중앙회', '35': '전북은행',
  '42': '제주은행', '15': '카카오뱅크', '3A': '케이뱅크', '24': '토스뱅크',
  '21': '하나카드', '61': '현대카드', '11': 'KB국민카드', '91': 'NH농협카드',
  '34': 'Sh수협은행',
};

function getCardCompanyName(code?: string): string {
  if (!code) return '';
  return CARD_ISSUER_MAP[code] || code;
}

/** 결제 상태 한국어 + 색상 */
function getStatusInfo(status?: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    succeeded: { label: '결제 완료', cls: 'text-green-600 dark:text-green-400' },
    failed: { label: '결제 실패', cls: 'text-red-600 dark:text-red-400' },
    refunded: { label: '환불 완료', cls: 'text-zinc-500 dark:text-zinc-400' },
    pending: { label: '처리 중', cls: 'text-blue-600 dark:text-blue-400' },
    partially_refunded: { label: '부분 환불', cls: 'text-zinc-500' },
  };
  return map[status?.toLowerCase() || ''] || { label: status || '-', cls: 'text-zinc-500' };
}

/* ─────────── Props ─────────── */

interface PaymentDetailModalProps {
  payment: PaymentHistory | null;
  open: boolean;
  onClose: () => void;
}

/* ─────────── 메인 컴포넌트 ─────────── */

export default function PaymentDetailModal({
  payment,
  open,
  onClose,
}: PaymentDetailModalProps) {
  if (!payment) return null;

  const card = payment.metadata?.card;
  const approvedAt = payment.metadata?.approvedAt;
  const orderId = payment.metadata?.orderId || payment.transactionId;
  const statusInfo = getStatusInfo(payment.status);

  // 카드사 이름
  const cardCompany =
    card?.cardCompany || getCardCompanyName(card?.issuerCode) || '';

  // 카드번호: 토스가 반환하는 형태 그대로 사용 (앞6자리 + 마스킹)
  // 예: "457973**********" 또는 "****5536"
  const cardNumber = card?.cardNumber || '';

  // 할부
  const installment =
    card?.installmentPlanMonths && card.installmentPlanMonths > 0
      ? `${card.installmentPlanMonths}개월`
      : '일시불';

  // 금액 상세 (VAT 10%)
  const totalAmount = payment.amount || 0;
  const supplyAmount = Math.floor(totalAmount / 1.1);
  const vatAmount = totalAmount - supplyAmount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 bg-white dark:bg-[#1a1d24] border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
            결제 상세
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto">

          {/* ════════ 거래정보 ════════ */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>거래정보</SectionTitle>
            <div className="space-y-3 mt-3">
              {card?.approveNo && (
                <Row label="카드 승인번호" value={card.approveNo} />
              )}
              {cardCompany && (
                <Row label="카드종류" value={cardCompany} />
              )}
              {cardNumber && (
                <Row label="카드번호" value={cardNumber} mono />
              )}
              <Row label="할부" value={installment} />
              <Row
                label="결제일시"
                value={formatDateTime(approvedAt || payment.paidAt || payment.createdAt)}
              />
              <Row
                label="주문내용"
                value={payment.description || '구독 결제'}
              />
              {orderId && (
                <Row label="주문번호" value={orderId} mono />
              )}
              <Row
                label="결제상태"
                value={
                  <span className={`font-medium ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                }
              />
            </div>
          </div>

          {/* ════════ 카드영수증 발행금액 ════════ */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>카드영수증 발행금액</SectionTitle>
            <div className="space-y-3 mt-3">
              <Row label="공급가액" value={`${formatAmount(supplyAmount)}원`} />
              <Row label="부가세액" value={`${formatAmount(vatAmount)}원`} />
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
                <Row label="총 금액" value={`${formatAmount(totalAmount)}원`} bold />
              </div>
            </div>
          </div>

          {/* ═══ 카드 매출전표 버튼 ═══ */}
          {payment.receiptUrl && (
            <div className="px-6 py-3">
              <a
                href={payment.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                카드영수증
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </a>
            </div>
          )}

          {/* ════════ 가맹점 정보 ════════ */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>가맹점 정보</SectionTitle>
            <div className="space-y-3 mt-3">
              <Row label="상호" value="AIGORY (예정)" />
              <Row label="대표자명" value="박시형" />
              <Row label="사업자등록번호" value="법인 설립 후 표시" />
              <Row label="전화번호" value="준비 중" />
              <Row label="주소" value="경기도 성남시 분당구" />
            </div>
          </div>

          {/* ════════ 판매자 정보 ════════ */}
          {/* SaaS 구독 모델에서는 가맹점=판매자 동일하므로 동일 정보 표시 */}
          {/* 마켓플레이스 거래 추가 시 판매자와 분리 필요 */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>판매자 정보</SectionTitle>
            <div className="space-y-3 mt-3">
              <Row label="상호" value="AIGORY (예정)" />
              <Row label="대표자명" value="박시형" />
              <Row label="사업자등록번호" value="법인 설립 후 표시" />
              <Row label="주소" value="경기도 성남시 분당구" />
            </div>
          </div>

          {/* ═══ 실패 사유 (실패 시만) ═══ */}
          {payment.failureReason && (
            <div className="px-6 py-4 border-t border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
              <SectionTitle className="text-red-500">실패 사유</SectionTitle>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {payment.failureReason}
                {payment.failureCode && (
                  <span className="text-xs text-red-400 ml-1">({payment.failureCode})</span>
                )}
              </p>
            </div>
          )}

          {/* 하단 여백 */}
          <div className="h-4" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── 섹션 타이틀 ─────────── */

function SectionTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h4 className={`text-sm font-semibold text-gray-900 dark:text-white ${className}`}>
      {children}
    </h4>
  );
}

/* ─────────── 행 컴포넌트 ─────────── */

function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500 dark:text-zinc-400 shrink-0">
        {label}
      </span>
      <span
        className={`text-sm text-right ${
          bold
            ? 'font-bold text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-zinc-300'
        } ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
