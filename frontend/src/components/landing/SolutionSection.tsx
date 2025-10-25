'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * Solution Section - 인터랙티브 데모
 *
 * 대화 → 블로그 포스트 변환 과정을 시각적으로 보여줌
 * Parallax 효과로 입체감 부여
 */
export default function SolutionSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Parallax 효과
  const leftY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const rightY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={ref} className="py-32 px-4 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* 섹션 타이틀 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full mb-6"
          >
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
              마법 같은 자동화
            </span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6">
            대화하면,{' '}
            <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
              블로그가 됩니다
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            위 내용 자동포스팅 해줘! 단, 한마디면 호출되는 Codebase MCP로 자동 포스팅 완료.
          </p>
        </motion.div>

        {/* 인터랙티브 데모 영역 */}
        <div className="relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 좌측: Claude 대화창 */}
            <motion.div
              style={{ y: leftY }}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              {/* 대화창 컨테이너 */}
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                {/* 헤더 */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-gray-400 ml-4 font-mono">Claude Code CLI</span>
                </div>

                {/* 대화 내용 */}
                <div className="p-6 space-y-4 font-mono text-sm">
                  {/* 사용자 메시지 */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex justify-end"
                  >
                    <div className="bg-cyan-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-md">
                      <p>위 내용 자동포스팅해줘 --tutorial</p>
                    </div>
                  </motion.div>

                  {/* Claude 응답 */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex justify-start"
                  >
                    <div className="bg-gray-700 text-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm max-w-md">
                      <p className="mb-2">네, 튜토리얼 스타일로 작성하겠습니다.</p>
                      <div className="flex items-center gap-2 text-cyan-400">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Sparkles className="w-4 h-4" />
                        </motion.div>
                        <span className="text-xs">블로그 포스트 생성 중...</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* 하이라이트 효과 */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full origin-left"
                  />
                </div>
              </div>

              {/* 부가 라벨 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -top-4 -left-4 px-4 py-2 bg-cyan-500 text-white rounded-lg shadow-lg font-semibold text-sm"
              >
                1. 평소처럼 대화
              </motion.div>
            </motion.div>

            {/* 중앙: 화살표 */}
            <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <motion.div
                animate={{
                  x: [0, 10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-2xl border-4 border-purple-500"
              >
                <ArrowRight className="w-8 h-8 text-purple-500" />
              </motion.div>
            </div>

            {/* 우측: 블로그 포스트 */}
            <motion.div
              style={{ y: rightY }}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              {/* 블로그 포스트 컨테이너 */}
              <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    blog.example.com
                  </span>
                </div>

                {/* 블로그 콘텐츠 */}
                <div className="p-6 space-y-4">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-2xl font-bold text-black dark:text-white"
                  >
                    React Server Components 완벽 가이드
                  </motion.h1>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex gap-2"
                  >
                    <span className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full text-xs font-semibold">
                      #React
                    </span>
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-semibold">
                      #Tutorial
                    </span>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="space-y-2 text-gray-700 dark:text-gray-300"
                  >
                    <p className="text-sm leading-relaxed">
                      React Server Components는 서버에서 렌더링되는 새로운 컴포넌트 유형입니다...
                    </p>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
                  </motion.div>

                  {/* 생성 완료 표시 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-semibold">포스트 생성 완료!</span>
                  </motion.div>
                </div>
              </div>

              {/* 부가 라벨 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: 0.9 }}
                className="absolute -bottom-4 -right-4 px-4 py-2 bg-purple-500 text-white rounded-lg shadow-lg font-semibold text-sm"
              >
                2. 자동으로 발행
              </motion.div>
            </motion.div>
          </div>
        </div>

      </div>
    </section>
  );
}
