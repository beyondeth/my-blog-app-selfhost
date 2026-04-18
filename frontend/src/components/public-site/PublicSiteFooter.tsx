import Link from 'next/link';
import { Copyright } from 'lucide-react';
import { PUBLIC_LEGAL_LINKS, PUBLIC_RESOURCES } from '@/lib/public-site';

export default function PublicSiteFooter() {
  return (
    <footer className="border-t border-[#152131] bg-[#0c1622] text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(200px,0.7fr))]">
          <div className="space-y-5">
            <div
              className="inline-flex items-center gap-2 text-lg font-bold tracking-[0.08em] text-white"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Copyright aria-hidden="true" size={16} className="text-[#d7e0eb]" />
              <span>Codebase</span>
            </div>
            <p className="max-w-lg text-sm leading-7 text-[#9fb2c6]">
              Codebase is a platform that automatically refines and publishes
              conversations from everyday users across AI platforms, turning them
              into structured knowledge for ongoing knowledge management.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d92a9]">
              Resources
            </h3>
            <div className="mt-4 space-y-3">
              {PUBLIC_RESOURCES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-[#d7e0eb] transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d92a9]">
              Legal
            </h3>
            <div className="mt-4 space-y-3">
              {PUBLIC_LEGAL_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-[#d7e0eb] transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
