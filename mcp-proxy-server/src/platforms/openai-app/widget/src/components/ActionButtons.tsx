import { useState, useCallback } from 'react';
import { t } from '../i18n';
import { openExternal, callTool } from '../hooks/useOpenAI';

interface ActionButtonsProps {
  status: string;
  href: string;
}

export default function ActionButtons({ status, href }: ActionButtonsProps) {
  const s = status.toLowerCase();

  return (
    <section className="actions">
      {s === 'published' && href && (
        <button
          className="btn btn-primary"
          onClick={() => openExternal(href)}
        >
          {t('view_post')}
        </button>
      )}
    </section>
  );
}
