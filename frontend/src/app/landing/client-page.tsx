'use client';

import HeroSection from '@/components/landing/HeroSection';
import ProblemSection from '@/components/landing/ProblemSection';
import SolutionSection from '@/components/landing/SolutionSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import SocialProofSection from '@/components/landing/SocialProofSection';
import CTASection from '@/components/landing/CTASection';
import FAQSection from '@/components/landing/FAQSection';
import FooterCTA from '@/components/landing/FooterCTA';

/**
 * 랜딩페이지 - MCP 자동포스팅 플랫폼
 *
 * 구조:
 * 1. Hero - 타이핑 애니메이션 + 데모 영상 CTA
 * 2. Problem - 사용자 공감 (3가지 문제점)
 * 3. Solution - 인터랙티브 데모 (대화 → 블로그)
 * 4. How It Works - 3단계 가이드
 * 5. Social Proof - 사용자 블로그 갤러리
 * 6. CTA - 주요 전환 섹션
 * 7. FAQ - 자주 묻는 질문
 * 8. Footer - 최종 CTA + 링크
 *
 * 디자인 원칙:
 * - 미니멀/감성적 톤앤매너
 * - 생산성 혁신 강조
 * - 데모 영상 시청을 주요 전환 목표로 설정
 */
export default function LandingClientPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden">
      {/* Hero Section - First Impression */}
      <HeroSection />

      {/* Problem Section - 공감 유도 */}
      <ProblemSection />

      {/* Solution Section - 핵심 기능 시연 */}
      <SolutionSection />

      {/* How It Works - 사용 방법 */}
      <HowItWorksSection />

      {/* Social Proof - 신뢰 구축 */}
      <SocialProofSection />

      {/* CTA Section - 주요 전환 */}
      <CTASection />

      {/* FAQ Section - 의심 해소 */}
      <FAQSection />

      {/* Footer - 최종 CTA + 링크 */}
      <FooterCTA />
    </div>
  );
}
