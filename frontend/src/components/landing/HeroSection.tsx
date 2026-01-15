'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

/**
 * Hero Section - 타이핑 애니메이션 + 데모 영상 CTA
 *
 * 미니멀한 디자인으로 핵심 메시지 전달:
 * "대화를 블로그로, 인사이트를 자산으로"
 */
// 타이핑 애니메이션 시퀀스
const typingSequence = [
  "매일 AI와 대화하시나요?",
  "그 대화, 사라지게 두시나요?",
];

/**
 * Hero Section - 타이핑 애니메이션 + 데모 영상 CTA
 *
 * 미니멀한 디자인으로 핵심 메시지 전달:
 * "대화를 블로그로, 인사이트를 자산으로"
 */
export default function HeroSection() {
  const [typingStep, setTypingStep] = useState(0);

  useEffect(() => {
    // 1초마다 타이핑 단계 진행
    const timer = setTimeout(() => {
      if (typingStep < typingSequence.length) {
        setTypingStep(typingStep + 1);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [typingStep]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* 배경 그라데이션 효과 */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
        <div className="text-center space-y-12">
          {/* 타이핑 애니메이션 영역 */}
          <div className="min-h-[120px] flex flex-col items-center justify-center gap-2">
            {typingStep >= 1 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400"
              >
                {typingSequence[0]}
              </motion.p>
            )}
            {typingStep >= 2 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400"
              >
                {typingSequence[1]}
              </motion.p>
            )}
          </div>

          {/* 메인 헤드라인 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 3 }}
            className="space-y-6"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="block text-black dark:text-white">
                대화를 블로그로,
              </span>
              <span className="block mt-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                생각을 내 것으로.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              AI와 나눈 대화를 자동으로 블로그로 만들어보세요.
              <br className="hidden sm:block" />
              글쓰기 시간이 10분의 1로 줄어듭니다.
            </p>

            {/* AI 로고 섹션 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 3.3 }}
              className="pt-8"
            >
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">지원하는 AI 모델</p>
              <div className="flex flex-wrap items-center justify-center gap-8">
                {/* Claude */}
                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">C</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">Claude</span>
                </div>

                {/* ChatGPT */}
                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">G</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">ChatGPT</span>
                </div>

                {/* Gemini */}
                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">G</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">Gemini</span>
                </div>

                {/* Qwen */}
                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">Q</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">Qwen</span>
                </div>

                {/* 더보기 */}
                <div className="flex items-center gap-2 opacity-60">
                  <span className="text-gray-500 dark:text-gray-500 font-medium">+ more</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* CTA 버튼 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 3.5 }}
            className="flex flex-col items-center justify-center gap-4 pt-8"
          >
            {/* 무료 시작하기 (주요 CTA) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              무료로 시작하기
            </motion.button>

            {/* 부가 설명 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 3.8 }}
              className="text-sm text-gray-500 dark:text-gray-500"
            >
              AI와 나눈 대화를 자동으로 블로그로 만드는 플랫폼
            </motion.p>
          </motion.div>

          {/* 스크롤 힌트 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 4 }}
            className="pt-8"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-block"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
