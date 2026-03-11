import { getStatusLabel, getStepBadge } from '../i18n';

interface HeaderProps {
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  connected: '#34c759',
  published: '#007aff',
  blocked: '#ffcc00',
  error: '#ff3b30',
  drafting: '#3b82f6',
  guide_ready: '#5ac8fa',
  style_confirmed: '#5ac8fa',
  awaiting_style_selection: '#ffcc00',
  ready: '#8e8e93',
};

export default function Header({ status }: HeaderProps) {
  const s = status.toLowerCase();
  const color = STATUS_COLORS[s] || '#8e8e93';

  return (
    <header className="head">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">CB</div>
        <div>
          <h1 className="title">Codebase</h1>
          <div className="subtitle-row">
            <p className="subtitle">ChatGPT 자동블로깅</p>
          </div>
        </div>
      </div>
      <span
        className="status"
        style={{ background: color + '1a', color }}
      >
        {getStatusLabel(status)}
      </span>
    </header>
  );
}
