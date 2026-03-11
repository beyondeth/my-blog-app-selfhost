import { useEffect, useState, useCallback } from 'react';
import Header from './components/Header';
import MetaGrid from './components/MetaGrid';
import StyleSelector from './components/StyleSelector';
import ProgressStepper from './components/ProgressStepper';
import ContentPreview from './components/ContentPreview';
import HintBox from './components/HintBox';
import ActionButtons from './components/ActionButtons';
import { useWidgetState } from './hooks/useWidgetState';
import { useNotifyHeight, canCallTool, restoreWidgetState } from './hooks/useOpenAI';
import { t, humanizeAuthMode } from './i18n';
import type { MetaEntry } from './types';

export default function App() {
  const state = useWidgetState();
  const { ref, notify } = useNotifyHeight();
  const s = state.status;
  const workflowStage = state.workflowStage;
  const out = state.out;
  const headerStatus = workflowStage === 'drafting' ? 'drafting' : s;

  // Style submit callback from StyleSelector
  const [styleSubmit, setStyleSubmit] = useState<{ fn: (() => void) | null; submitting: boolean }>({ fn: null, submitting: false });
  const handleSubmitReady = useCallback((submit: (() => void) | null, isSubmitting: boolean) => {
    setStyleSubmit({ fn: submit, submitting: isSubmitting });
  }, []);

  // Notify height after every render
  useEffect(() => { notify(); });

  // Restore persisted state on mount
  useEffect(() => {
    restoreWidgetState();
  }, []);

  // ── Build meta entries by status ──
  const entries: MetaEntry[] = [];

  if (s === 'connected') {
    if (out.username) entries.push({ label: t('account'), value: String(out.username) });
    if (out.blogName) entries.push({ label: t('blog'), value: String(out.blogName) });
    if (out.authMode) entries.push({ label: t('auth_mode'), value: humanizeAuthMode(String(out.authMode)) });
    entries.push({ label: t('next_step'), value: t('select_style_hint') });
  } else if (workflowStage === 'drafting' || s === 'drafting') {
    if (out.styleLabel || out.style) entries.push({ label: t('selected_style'), value: String(out.styleLabel || out.style) });
    if (out.blogName) entries.push({ label: t('blog'), value: String(out.blogName) });
    if (out.authMode) entries.push({ label: t('auth_mode'), value: humanizeAuthMode(String(out.authMode)) });
    entries.push({ label: t('next_step'), value: t('progress_publish_desc') });
  } else if (s === 'published') {
    if (out.title) entries.push({ label: t('title'), value: String(out.title) });
    if (out.category) entries.push({ label: t('category'), value: String(out.category) });
    if (out.writingStyle) entries.push({ label: t('writing_style'), value: String(out.writingStyle) });
    if (out.tags?.length) entries.push({ label: t('tags'), value: out.tags.join(', ') });
    if (out.blogName) entries.push({ label: t('blog'), value: String(out.blogName) });
    if (out.publishedAt) {
      const d = new Date(out.publishedAt);
      entries.push({ label: t('published_at'), value: isNaN(d.getTime()) ? String(out.publishedAt) : d.toLocaleString() });
    }
    if (out.estimatedWordCount) entries.push({ label: t('word_count'), value: String(out.estimatedWordCount) });
  } else if (s === 'guide_ready' || s === 'style_confirmed') {
    if (out.style || out.styleLabel) entries.push({ label: t('selected_style'), value: String(out.styleLabel || out.style) });
    if (out.hasCustomMarkdown !== undefined) entries.push({ label: t('custom_guide'), value: out.hasCustomMarkdown ? t('yes') : t('no') });
  } else if (s === 'blocked' || s === 'awaiting_style_selection') {
    if (out.username) entries.push({ label: t('account'), value: String(out.username) });
    if (out.blogName) entries.push({ label: t('blog'), value: String(out.blogName) });
    if (out.authMode) entries.push({ label: t('auth_mode'), value: humanizeAuthMode(String(out.authMode)) });
    entries.push({ label: t('next_step'), value: t('select_style_hint') });
  } else {
    // General fallback
    if (out.toolName) entries.push({ label: t('task'), value: String(out.toolName) });
    if (out.status) entries.push({ label: t('status'), value: String(out.status) });
    if (out.reason) entries.push({ label: t('reason'), value: String(out.reason) });
    if (out.username) entries.push({ label: t('account'), value: String(out.username) });
    if (out.blogName) entries.push({ label: t('blog'), value: String(out.blogName) });
  }

  // Empty state
  if (entries.length === 0 && !state.isStyleSelectionStage) {
    return (
      <div ref={ref} className="shell">
        <div className="card">
          <Header status={headerStatus} />
          <div className="body">
            <HintBox text={t('empty')} />
          </div>
        </div>
      </div>
    );
  }

  const canSelect = Boolean(state.styleSelectionNonce) && canCallTool();
  const showStyleSubmit = state.isStyleSelectionStage && state.styleOptions.length > 0;

  return (
    <div ref={ref} className="shell">
      <div className="card">
        <Header status={headerStatus} />

        <div className="body">
          {/* Error messages only */}
          {out.message && s === 'error' && <HintBox text={String(out.message)} isWarning />}

          {(state.isStyleSelectionStage || workflowStage === 'drafting' || s === 'published') && (
            <ProgressStepper stage={workflowStage || s} />
          )}

          {/* Meta info */}
          <MetaGrid entries={entries} />

          {/* Style selection */}
          {showStyleSubmit && (
            <StyleSelector
              options={state.styleOptions}
              nonce={state.styleSelectionNonce}
              canSelect={canSelect}
              onSubmitReady={handleSubmitReady}
            />
          )}

          {/* Content preview */}
          <ContentPreview
            text={out.contentPreview || ''}
            visible={s === 'guide_ready' || s === 'published'}
          />
        </div>

        {/* Actions — both buttons render in same position outside .body */}
        {showStyleSubmit && (
          <section className="actions">
            <button
              className="btn btn-primary"
              disabled={styleSubmit.submitting || !styleSubmit.fn}
              onClick={() => styleSubmit.fn?.()}
            >
              {styleSubmit.submitting ? t('guide_submitting') : t('guide_submit')}
            </button>
          </section>
        )}
        <ActionButtons
          status={s}
          href={out.postUrl || out.blogUrl || ''}
        />
      </div>
    </div>
  );
}
