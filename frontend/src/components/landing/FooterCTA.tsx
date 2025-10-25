'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { fadeUp, defaultViewport } from '@/lib/animations/landing-animations';

/**
 * Footer CTA - 마지막 전환 기회 + 푸터 링크
 *
 * 최종 CTA와 함께 법적 문서 및 소셜 링크 제공
 */
export default function FooterCTA() {
  return (
    <footer className="bg-gray-900 dark:bg-black text-white">
      {/* 최종 CTA */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            className="text-center space-y-8"
          >
            {/* 메시지 */}
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                당신의 대화는{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  소중합니다
                </span>
              </h2>
              <p className="text-lg sm:text-xl text-gray-400">
                사라지게 두지 마세요
              </p>
            </div>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-shadow"
              >
                지금 시작하기
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 푸터 링크 */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* 하단 링크 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-gray-400">
          <Link href="/support" className="hover:text-white transition-colors">
            고객지원
          </Link>
          <Link href="/legal/guidelines" className="hover:text-white transition-colors">
            커뮤니티 가이드라인
          </Link>
          <Link href="/legal/terms" className="hover:text-white transition-colors">
            이용약관
          </Link>
          <Link href="/legal/privacy" className="hover:text-white transition-colors">
            개인정보처리방침
          </Link>
          <Link href="/sitemap" className="hover:text-white transition-colors">
            사이트맵
          </Link>
        </div>

        {/* 카피라이트 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">© 2025 Codebase.blog. All rights reserved.</p>
        </div>
      </div>

      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>
    </footer>
  );
}
