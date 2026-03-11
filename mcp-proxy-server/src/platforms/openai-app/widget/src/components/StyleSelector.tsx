import { useState, useCallback, useEffect } from 'react';
import type { StyleOption } from '../types';
import { t } from '../i18n';
import {
  callTool,
  saveWidgetState,
  updateModelContext,
  sendUserMessage,
  canCallTool,
} from '../hooks/useOpenAI';

interface StyleSelectorProps {
  options: StyleOption[];
  nonce: string;
  canSelect: boolean;
  onSubmitReady?: (submit: (() => void) | null, isSubmitting: boolean) => void;
}

export default function StyleSelector({ options, nonce, canSelect, onSubmitReady }: StyleSelectorProps) {
  const [selected, setSelected] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hint, setHint] = useState('');
  const [activeNonce, setActiveNonce] = useState(nonce);

  useEffect(() => {
    setActiveNonce(nonce);
  }, [nonce]);

  const handleSelect = useCallback((id: string) => {
    if (isSubmitting) return;
    setSelected(id);
    const opt = options.find(o => o.id === id);
    setHint(`✅ ${opt?.label || id} 스타일이 선택되었습니다.`);
  }, [isSubmitting, options]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !selected) {
      setHint('진행 중이거나 선택된 스타일이 없습니다.');
      return;
    }
    if (!activeNonce || !canCallTool()) {
      setHint('OpenAI API 통신 준비가 되지 않았거나 세션이 만료되었습니다. 새로고침해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setHasSubmitted(true);
    setHint(`'${selected}' ` + t('submitting_style'));

    try {
      const response = await callTool('confirm_style', {
        style: selected,
        selectionSource: 'widget',
        selectionNonce: activeNonce,
      });

      const out = response?.structuredContent || {};
      const meta = response?._meta || {};
      const status = String(out.status || (meta as Record<string, unknown>).status || '').toLowerCase();
      const styleBrief = typeof out.styleBrief === 'string' ? out.styleBrief : '';

      if (status === 'guide_ready') {
        setHint('');
        saveWidgetState({
          modelContent: 'Style confirmed: ' + selected,
          privateContent: { confirmedStyle: selected, progressStage: 'drafting' },
        });
        await updateModelContext(
          JSON.stringify({
            event: 'style_confirmed',
            selectedStyle: selected,
            styleLabel: out.styleLabel || selected,
            readyForPost: true,
            styleBrief,
            instruction: 'IMPORTANT: The user has confirmed their writing style via the widget. '
              + 'DO NOT ask about styles again. DO NOT recommend a different style. '
              + 'Immediately call create_post to draft and publish the blog post using this confirmed style.',
          })
        );
        await sendUserMessage(
          [
            `The user has already confirmed the writing style via the widget: ${String(out.styleLabel || selected)}.`,
            'This choice is final. Do not ask for the style again. Continue the original posting request now.',
            'Call create_post as the next step.',
          ].filter(Boolean).join('\n\n')
        );
      } else if (status === 'blocked') {
        const reason = String(out.reason || meta.summary || t('session_renewed'));
        setHint(`진행 불가: ${reason}`);
        setHasSubmitted(false);
        const newNonce = out.styleSelectionNonce || meta.styleSelectionNonce;
        if (typeof newNonce === 'string' && newNonce) {
          setActiveNonce(newNonce);
        }
      } else {
        setHint(`상태 메시지: ${status} (서버 응답 대기 중)`);
        setHasSubmitted(false);
      }
    } catch (err) {
      console.error('[Widget] Submit error:', err);
      setHint(t('submit_fail') + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, selected, activeNonce]);

  // Expose submit to parent for rendering button outside .body
  useEffect(() => {
    onSubmitReady?.(selected && canSelect && !hasSubmitted ? handleSubmit : null, isSubmitting || hasSubmitted);
  }, [selected, canSelect, isSubmitting, hasSubmitted, handleSubmit, onSubmitReady]);

  if (options.length === 0) return null;

  return (
    <div>
      <div className="style-grid">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={`style-item${selected === opt.id ? ' selected' : ''}`}
            disabled={isSubmitting || !canSelect}
            onClick={() => handleSelect(opt.id)}
          >
            {opt.emoji && <span className="style-emoji">{opt.emoji}</span>}
            <div className="style-title">{opt.label || opt.id}</div>
            <p className="style-desc">{opt.description || ''}</p>
          </button>
        ))}
      </div>

      {hint && (
        <div className={`hint${!selected ? ' is-warning' : ''}`}>{hint}</div>
      )}
    </div>
  );
}
