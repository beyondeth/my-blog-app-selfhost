"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * 랜딩 페이지 - NotebookLM 스타일 + 블로그 플랫폼 맞춤 애니메이션
 * Framer Motion을 활용한 창의적인 3D 효과 및 인터랙션
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Hero Section - 타이핑 효과 + Fade-up */}
      <HeroSection />

      {/* 주요 기능 소개 타이틀 */}
      <TitleSection />

      {/* Feature Sections - 3D 회전 + Parallax */}
      <FeatureEditor />
      <FeatureMessaging />
      <FeatureSubscription />
      <FeatureAuth />

      {/* Use Cases Section - Stagger 애니메이션 */}
      <UseCasesSection />

      {/* What people are saying */}
      <TestimonialSection />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

/**
 * Hero 섹션 - 타이핑 효과처럼 순차적 등장
 */
function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center pt-32 pb-24 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* 메인 타이틀 - 글자별 등장 효과 */}
        <motion.h1
          className="text-5xl sm:text-6xl lg:text-7xl font-normal tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Create{" "}
          </motion.span>
          <motion.span
            className="text-gray-600"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Your Story
          </motion.span>
        </motion.h1>

        {/* 부제 - Fade up */}
        <motion.p
          className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          나만의 블로그 플랫폼에서 글을 쓰고, 공유하고, 성장하세요
        </motion.p>

        {/* CTA 버튼 - Scale up */}
        <motion.div
          className="pt-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-black text-white text-base rounded-lg hover:bg-gray-800 transition-colors"
          >
            시작하기
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * 타이틀 섹션 - Fade in
 */
function TitleSection() {
  return (
    <motion.section
      className="py-16 px-4"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-normal text-black mb-4">
          Your AI-Powered Blog Platform
        </h2>
      </div>
    </motion.section>
  );
}

/**
 * Feature 1: Rich Text Editor - 3D 회전 + Parallax
 */
function FeatureEditor() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Parallax 효과 - 텍스트와 이미지가 다른 속도로 이동
  const textY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const imageY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={ref} className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* 텍스트 영역 - Parallax */}
          <motion.div
            className="flex-1 space-y-6"
            style={{ y: textY }}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            <div className="space-y-2">
              <div className="text-4xl">✍️</div>
              <h3 className="text-3xl font-normal text-black">
                강력한 에디터로 완벽한 글쓰기
              </h3>
            </div>
            <p className="text-lg text-gray-600 leading-relaxed">
              Tiptap 기반의 풍부한 텍스트 에디터로 글을 작성하세요.
              코드 하이라이팅, Mermaid 다이어그램, 이미지 업로드 등
              다양한 기능을 지원합니다. 작성 중인 내용은 자동으로
              저장되어 안전합니다.
            </p>
          </motion.div>

          {/* Mock UI - 3D 회전 + Hover 확대 */}
          <motion.div
            className="flex-1 w-full"
            style={{ y: imageY, perspective: 1000 }}
            initial={{ opacity: 0, rotateY: -25, scale: 0.8 }}
            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: "easeOut" }}
            whileHover={{ scale: 1.05, rotateY: 5 }}
          >
            <div className="bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl aspect-video shadow-2xl flex items-center justify-center">
              <div className="text-white text-xl font-medium">Editor Preview</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Feature 2: Real-time Messaging - 반대 방향 3D 회전
 */
function FeatureMessaging() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const imageY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={ref} className="py-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16">
          {/* 텍스트 영역 */}
          <motion.div
            className="flex-1 space-y-6"
            style={{ y: textY }}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            <div className="space-y-2">
              <div className="text-4xl">💬</div>
              <h3 className="text-3xl font-normal text-black">
                실시간으로 소통하세요
              </h3>
            </div>
            <p className="text-lg text-gray-600 leading-relaxed">
              독자들과 실시간 메시지로 소통하고, 댓글로 의견을 나누며,
              좋아요로 공감을 표현하세요. Socket.IO 기반의 실시간
              알림으로 놓치지 않고 모든 반응을 확인할 수 있습니다.
            </p>
          </motion.div>

          {/* Mock UI - 오른쪽에서 회전 */}
          <motion.div
            className="flex-1 w-full"
            style={{ y: imageY, perspective: 1000 }}
            initial={{ opacity: 0, rotateY: 25, scale: 0.8 }}
            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: "easeOut" }}
            whileHover={{ scale: 1.05, rotateY: -5 }}
          >
            <div className="bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl aspect-video shadow-2xl flex items-center justify-center">
              <div className="text-white text-xl font-medium">Chat Preview</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Feature 3: Subscription System
 */
function FeatureSubscription() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const imageY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={ref} className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* 텍스트 영역 */}
          <motion.div
            className="flex-1 space-y-6"
            style={{ y: textY }}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            <div className="space-y-2">
              <div className="text-4xl">📊</div>
              <h3 className="text-3xl font-normal text-black">
                수익화부터 성장까지
              </h3>
            </div>
            <p className="text-lg text-gray-600 leading-relaxed">
              구독 시스템으로 수익을 창출하고, 상세한 분석 대시보드로
              독자 트렌드를 파악하세요. Stripe 결제 연동으로 안전하고
              편리한 결제가 가능하며, 구독자 관리도 쉽게 할 수 있습니다.
            </p>
          </motion.div>

          {/* Mock UI */}
          <motion.div
            className="flex-1 w-full"
            style={{ y: imageY, perspective: 1000 }}
            initial={{ opacity: 0, rotateY: -25, scale: 0.8 }}
            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: "easeOut" }}
            whileHover={{ scale: 1.05, rotateY: 5 }}
          >
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl aspect-video shadow-2xl flex items-center justify-center">
              <div className="text-white text-xl font-medium">Analytics Preview</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Feature 4: Social Login
 */
function FeatureAuth() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const imageY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={ref} className="py-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16">
          {/* 텍스트 영역 */}
          <motion.div
            className="flex-1 space-y-6"
            style={{ y: textY }}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            <div className="space-y-2">
              <div className="text-4xl">🔐</div>
              <h3 className="text-3xl font-normal text-black">
                간편한 소셜 로그인
              </h3>
            </div>
            <p className="text-lg text-gray-600 leading-relaxed">
              Google, GitHub, Kakao 계정으로 간편하게 가입하고
              로그인하세요. OAuth2 기반의 안전한 인증 시스템으로
              개인정보를 보호하며, 번거로운 회원가입 절차 없이
              바로 시작할 수 있습니다.
            </p>
          </motion.div>

          {/* Mock UI */}
          <motion.div
            className="flex-1 w-full"
            style={{ y: imageY, perspective: 1000 }}
            initial={{ opacity: 0, rotateY: 25, scale: 0.8 }}
            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1, ease: "easeOut" }}
            whileHover={{ scale: 1.05, rotateY: -5 }}
          >
            <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl aspect-video shadow-2xl flex items-center justify-center">
              <div className="text-white text-xl font-medium">Auth Preview</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Use Cases Section - Stagger 애니메이션
 */
function UseCasesSection() {
  // 카드 데이터
  const cards = [
    {
      emoji: "📝",
      title: "블로거",
      description:
        "일상과 생각을 기록하고 공유하세요. 독자들과 소통하며 나만의 커뮤니티를 만들어가세요.",
    },
    {
      emoji: "✨",
      title: "작가",
      description:
        "긴 글과 연재물을 체계적으로 관리하세요. 강력한 에디터로 완성도 높은 콘텐츠를 만드세요.",
    },
    {
      emoji: "🤝",
      title: "팀",
      description:
        "함께 협업하고 아이디어를 나누세요. 실시간 소통으로 효율적인 팀 블로그를 운영하세요.",
    },
  ];

  // 컨테이너 애니메이션 설정
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2, // 자식 요소들이 0.2초 간격으로 등장
      },
    },
  };

  // 카드 애니메이션 설정
  const item = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut" as any,
      },
    },
  };

  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 섹션 타이틀 */}
        <motion.h2
          className="text-4xl sm:text-5xl font-normal text-black text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
        >
          How people are using our platform
        </motion.h2>

        {/* 카드 그리드 - Stagger 효과 */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {cards.map((card, index) => (
            <motion.div
              key={index}
              variants={item}
              whileHover={{
                scale: 1.05,
                y: -10,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition-shadow"
            >
              <div className="space-y-4">
                <div className="text-5xl">{card.emoji}</div>
                <h3 className="text-2xl font-medium text-black">{card.title}</h3>
                <p className="text-gray-600 leading-relaxed">{card.description}</p>
                <div className="pt-4">
                  <Link
                    href="/register"
                    className="text-black hover:text-gray-600 font-medium inline-flex items-center gap-2"
                  >
                    시작하기 →
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Testimonial Section
 */
function TestimonialSection() {
  return (
    <motion.section
      className="py-16 px-4"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-normal text-black">
          What people are saying
        </h2>
      </div>
    </motion.section>
  );
}

/**
 * Footer Section
 */
function FooterSection() {
  return (
    <motion.footer
      className="py-16 px-4 border-t border-gray-200"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-12">
          {/* 브랜드 */}
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">Codebase.blog</div>
          </div>

          {/* Legal 링크 그룹 */}
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
            {/* 핵심 약관 */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-black mb-1">Legal</h3>
              <Link href="/legal/terms" className="text-sm text-gray-600 hover:text-black">
                Terms of Service
              </Link>
              <Link href="/legal/privacy" className="text-sm text-gray-600 hover:text-black">
                Privacy Policy
              </Link>
              <Link href="/legal/guidelines" className="text-sm text-gray-600 hover:text-black">
                Community Guidelines
              </Link>
            </div>

            {/* 구독 및 파트너 */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-black mb-1">Programs</h3>
              <Link href="/legal/pro" className="text-sm text-gray-600 hover:text-black">
                PRO Subscription
              </Link>
              <Link href="/legal/partner" className="text-sm text-gray-600 hover:text-black">
                Partner Program
              </Link>
              <Link href="/legal/username" className="text-sm text-gray-600 hover:text-black">
                Username Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            © 2025 Codebase.blog. All rights reserved.
          </p>
        </div>
      </div>
    </motion.footer>
  );
}
