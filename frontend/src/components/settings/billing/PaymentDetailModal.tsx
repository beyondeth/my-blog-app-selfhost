'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, CreditCard } from 'lucide-react';
import type { PaymentHistory } from '@/types/subscription';

/* Utilities */

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
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

const CARD_ISSUER_MAP: Record<string, string> = {
  '3K': 'IBK BC',
  '46': 'Kwangju Bank',
  '71': 'Lotte Card',
  '30': 'KDB Industrial Bank',
  '31': 'BC Card',
  '51': 'Samsung Card',
  '38': 'Saemaeul Geumgo',
  '41': 'Shinhan Card',
  '62': 'Credit Union',
  '36': 'Citibank Korea',
  '33': 'Woori BC',
  W1: 'Woori Card',
  '37': 'Korea Post',
  '39': 'Savings Bank Central',
  '35': 'Jeonbuk Bank',
  '42': 'Jeju Bank',
  '15': 'KakaoBank',
  '3A': 'K Bank',
  '24': 'Toss Bank',
  '21': 'Hana Card',
  '61': 'Hyundai Card',
  '11': 'KB Kookmin Card',
  '91': 'NH Nonghyup Card',
  '34': 'Sh Suhyup Bank',
};

function getCardCompanyName(code?: string): string {
  if (!code) return '';
  return CARD_ISSUER_MAP[code] || code;
}

function getStatusInfo(status?: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    succeeded: { label: 'Paid', cls: 'text-green-600 dark:text-green-400' },
    failed: { label: 'Failed', cls: 'text-red-600 dark:text-red-400' },
    refunded: { label: 'Refunded', cls: 'text-zinc-500 dark:text-zinc-400' },
    pending: { label: 'Processing', cls: 'text-blue-600 dark:text-blue-400' },
    partially_refunded: { label: 'Partially refunded', cls: 'text-zinc-500' },
  };
  return map[status?.toLowerCase() || ''] || { label: status || '-', cls: 'text-zinc-500' };
}

/* Props */

interface PaymentDetailModalProps {
  payment: PaymentHistory | null;
  open: boolean;
  onClose: () => void;
}

/* Main component */

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

  const cardCompany =
    card?.cardCompany || getCardCompanyName(card?.issuerCode) || '';

  const cardNumber = card?.cardNumber || '';

  const installment =
    card?.installmentPlanMonths && card.installmentPlanMonths > 0
      ? `${card.installmentPlanMonths} months`
      : 'One-time payment';

  const totalAmount = payment.amount || 0;
  const supplyAmount = Math.floor(totalAmount / 1.1);
  const vatAmount = totalAmount - supplyAmount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 bg-white dark:bg-[#1a1d24] border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
            Payment details
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto">

          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>Transaction</SectionTitle>
            <div className="space-y-3 mt-3">
              {card?.approveNo && (
                <Row label="Approval code" value={card.approveNo} />
              )}
              {cardCompany && (
                <Row label="Card issuer" value={cardCompany} />
              )}
              {cardNumber && (
                <Row label="Card number" value={cardNumber} mono />
              )}
              <Row label="Installment" value={installment} />
              <Row
                label="Paid at"
                value={formatDateTime(approvedAt || payment.paidAt || payment.createdAt)}
              />
              <Row
                label="Description"
                value={payment.description || 'Subscription payment'}
              />
              {orderId && (
                <Row label="Order ID" value={orderId} mono />
              )}
              <Row
                label="Status"
                value={
                  <span className={`font-medium ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                }
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>Receipt amounts</SectionTitle>
            <div className="space-y-3 mt-3">
              <Row label="Net amount" value={`₩${formatAmount(supplyAmount)}`} />
              <Row label="VAT" value={`₩${formatAmount(vatAmount)}`} />
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
                <Row label="Total" value={`₩${formatAmount(totalAmount)}`} bold />
              </div>
            </div>
          </div>

          {payment.receiptUrl && (
            <div className="px-6 py-3">
              <a
                href={payment.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                Card receipt
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </a>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>Merchant</SectionTitle>
            <div className="space-y-3 mt-3">
              <Row label="Business name" value="AIGORY (pending)" />
              <Row label="Representative" value="Sihyung Park" />
              <Row label="Business registration" value="Will be shown after incorporation" />
              <Row label="Phone" value="Coming soon" />
              <Row label="Address" value="Bundang-gu, Seongnam-si, Gyeonggi-do" />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <SectionTitle>Seller</SectionTitle>
            <div className="space-y-3 mt-3">
              <Row label="Business name" value="AIGORY (pending)" />
              <Row label="Representative" value="Sihyung Park" />
              <Row label="Business registration" value="Will be shown after incorporation" />
              <Row label="Address" value="Bundang-gu, Seongnam-si, Gyeonggi-do" />
            </div>
          </div>

          {payment.failureReason && (
            <div className="px-6 py-4 border-t border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
              <SectionTitle className="text-red-500">Failure reason</SectionTitle>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {payment.failureReason}
                {payment.failureCode && (
                  <span className="text-xs text-red-400 ml-1">({payment.failureCode})</span>
                )}
              </p>
            </div>
          )}

          <div className="h-4" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Section title */

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

/* Row component */

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
