import PublicSiteFooter from './PublicSiteFooter';
import PublicSiteHeader from './PublicSiteHeader';
import {
  PUBLIC_SITE_HEADER_OFFSET_CLASS,
  PUBLIC_SITE_MAIN_MIN_HEIGHT_CLASS,
} from './layoutConstants';

interface PublicSiteFrameProps {
  children: React.ReactNode;
}

export default function PublicSiteFrame({ children }: PublicSiteFrameProps) {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#101828] dark:bg-[#081018] dark:text-white">
      <PublicSiteHeader />
      <main className={`relative overflow-hidden ${PUBLIC_SITE_MAIN_MIN_HEIGHT_CLASS} ${PUBLIC_SITE_HEADER_OFFSET_CLASS}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,_rgba(45,90,214,0.14),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,24,40,0.05),_transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(105,143,255,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(108,195,178,0.08),_transparent_36%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(16,24,40,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,24,40,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.16] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] dark:opacity-[0.08]" />
        <div className="relative">{children}</div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
