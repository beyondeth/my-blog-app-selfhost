'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Search, Lightbulb } from 'lucide-react';
import { staggerContainer, staggerItem, defaultViewport } from '@/lib/animations/landing-animations';

/**
 * Problem Section - 사용자 공감 유도
 *
 * 3가지 일반적인 문제점을 제시하여
 * 사용자의 경험과 연결
 */
export default function ProblemSection() {
  // 문제 카드 데이터
  const problems = [
    {
      icon: MessageCircle,
      title: "Claude와 2시간 대화했는데",
      description: "다음날 대화 내용 기억 안 남",
      gradient: "from-cyan-500/10 to-blue-500/10",
      iconColor: "text-cyan-500",
    },
    {
      icon: Search,
      title: "예전에 나눈 대화 찾으려면",
      description: "무한 스크롤 지옥",
      gradient: "from-purple-500/10 to-pink-500/10",
      iconColor: "text-purple-500",
    },
    {
      icon: Lightbulb,
      title: "좋은 아이디어 얻었는데",
      description: "정리할 시간 없어서 흩어짐",
      gradient: "from-yellow-500/10 to-orange-500/10",
      iconColor: "text-yellow-500",
    },
  ];

  return (
    <section className="py-24 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* 섹션 타이틀 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-black dark:text-white mb-4">
            이런 경험 있으신가요?
          </h2>
          <div className="w-[480px] max-w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-500 mx-auto rounded-full" />
        </motion.div>

        {/* 문제 카드 그리드 - Stagger 애니메이션 */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              whileHover={{
                scale: 1.03,
                y: -8,
                transition: { type: 'spring', stiffness: 300, damping: 20 }
              }}
              className={`
                relative overflow-hidden
                bg-white dark:bg-gray-800
                rounded-2xl p-8
                shadow-lg hover:shadow-2xl
                transition-shadow duration-300
                border border-gray-200 dark:border-gray-700
              `}
            >
              {/* 배경 그라데이션 */}
              <div className={`absolute inset-0 bg-gradient-to-br ${problem.gradient} opacity-50`} />

              {/* 콘텐츠 */}
              <div className="relative z-10 space-y-6">
                {/* 아이콘 */}
                <div className="flex items-center justify-center">
                  <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-md">
                    <problem.icon className={`w-8 h-8 ${problem.iconColor}`} />
                  </div>
                </div>

                {/* 타이틀 */}
                <h3 className="text-xl font-semibold text-black dark:text-white text-center">
                  {problem.title}
                </h3>

                {/* 화살표 */}
                <div className="flex justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400 dark:text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>

                {/* 설명 */}
                <p className="text-lg text-gray-700 dark:text-gray-300 text-center font-medium">
                  {problem.description}
                </p>
              </div>

              {/* 흔들림 효과 (미세한 애니메이션) */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{
                  x: [0, 1, -1, 0],
                  y: [0, -1, 1, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.2,
                }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* 메시지 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center max-w-3xl mx-auto"
        >
          <div className="space-y-4 px-4">
            <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed">
              요즘 우리는 일상과 업무 속에서 AI와 점점 더 많이 대화합니다.
            </p>
            <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed">
              하지만 그 대화들은 대부분 기록되지 않고 사라집니다.
            </p>
            <p className="text-black dark:text-white text-base sm:text-lg font-semibold leading-relaxed">
              그래서 우리는, AI와의 대화를 지식으로 남길 수 있는 방법을 만들고 있습니다.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
