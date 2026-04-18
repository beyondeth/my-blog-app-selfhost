"use client";

import { useEffect, useId, useState } from 'react';
import { diagramBlockToD2, parseDiagramBlock } from '@/lib/diagram/diagram-block';
import { renderD2Source } from '@/lib/diagram/render-d2';
import { useModal } from '@/hooks/useModal';
import Modal from '@/components/ui/Modal';

interface DiagramRendererProps {
  id: string;
  content: string;
  className?: string;
  modalTitle?: string;
  onClick?: (svg: string) => void;
}

export default function DiagramRenderer({
  id,
  content,
  className = '',
  modalTitle = '다이어그램',
  onClick,
}: DiagramRendererProps) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [direction, setDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [stylePreset, setStylePreset] = useState<string | null>(null);
  const { modalData, isModalOpen, closeModal, handleDiagramClick } = useModal();
  const salt = `${useId().replace(/:/g, '_')}_${id}`;

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      try {
        setIsLoading(true);
        setError(null);

        const spec = parseDiagramBlock(content);
        setDirection(spec.direction);
        setStylePreset(spec.style);
        const d2Source = diagramBlockToD2(spec);
        const rendered = await renderD2Source(d2Source, {
          pad: 22,
          scale: 1.18,
          salt,
        });

        if (!active) return;
        setSvg(rendered);
      } catch (err) {
        if (!active) return;
        setDirection(null);
        setStylePreset(null);
        setError(err instanceof Error ? err.message : 'diagram 렌더링에 실패했습니다.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    renderDiagram();

    return () => {
      active = false;
    };
  }, [content, salt]);

  const handleActivate = () => {
    if (onClick) {
      onClick(svg);
      return;
    }

    handleDiagramClick(svg, modalTitle);
  };

  if (isLoading) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-2xl border border-[#DCE5EE] bg-[#FAFCFE] px-6 py-12 text-sm text-[#617487] dark:border-[#25313E] dark:bg-[#0F171F] dark:text-[#99ADBF] ${className}`}
        data-diagram-id={id}
        data-diagram-state="loading"
      >
        다이어그램 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 ${className}`}
        data-diagram-id={id}
        data-diagram-state="error"
      >
        <div className="border-b border-red-200 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:text-red-200">
          diagram block 렌더링 실패
        </div>
        <div className="px-4 py-3 text-sm leading-6 text-red-700 dark:text-red-200">{error}</div>
        <pre className="overflow-auto border-t border-red-200 bg-white px-4 py-4 text-xs leading-6 text-[#243547] dark:border-red-900/50 dark:bg-[#0B1118] dark:text-[#D5E4F1]">
          <code>{content}</code>
        </pre>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`block w-full border-0 bg-transparent p-0 text-left ${className}`}
        onClick={handleActivate}
        aria-label={`${modalTitle} 확대 보기`}
      >
        <div
          className="overflow-hidden rounded-2xl border border-[#DCE5EE] bg-[#FAFCFE] p-4 shadow-[0_20px_48px_-40px_rgba(17,24,39,0.28)] cursor-pointer transition-opacity hover:opacity-90 dark:border-[#25313E] dark:bg-[#0F171F] [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full"
          data-diagram-id={id}
          data-diagram-state="ready"
          data-diagram-direction={direction ?? 'unknown'}
          data-diagram-style={stylePreset ?? 'unknown'}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </button>

      {modalData && (
        <Modal
          type={modalData.type}
          content={modalData.content}
          alt={modalData.alt}
          title={modalData.title}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
}
