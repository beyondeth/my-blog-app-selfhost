import { useState } from 'react';
import { t } from '../i18n';

interface ContentPreviewProps {
  text: string;
  visible: boolean;
}

export default function ContentPreview({ text, visible }: ContentPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (!visible || !text) return null;

  return (
    <div className="preview-panel">
      <div className="preview-head">
        <p className="preview-title">{t('preview_title')}</p>
        <button
          className="preview-toggle"
          type="button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('preview_collapse') : t('preview_expand')}
        </button>
      </div>
      {expanded && (
        <div className="preview-body">{text}</div>
      )}
    </div>
  );
}
