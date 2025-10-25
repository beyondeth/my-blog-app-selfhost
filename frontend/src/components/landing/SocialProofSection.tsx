'use client';

import { motion } from 'framer-motion';
import { Code, BookOpen, FileText } from 'lucide-react';
import { staggerContainer, staggerItem, cardHover, defaultViewport } from '@/lib/animations/landing-animations';

/**
 * Use Cases Section - 활용 사례 섹션
 *
 * 실제 활용 가능한 사례들을 제시하여
 * 사용자가 구체적인 활용 방법을 이해할 수 있도록 함
 */
export default function SocialProofSection() {
  // 활용 사례 데이터
  const useCases = [
    {
      avatar: '👨‍💻',
      title: '개발 회고록을 자동으로 정리',
      description: '매일의 코딩 세션과 문제 해결 과정을 AI와 대화로 정리하면, 자동으로 개발 블로그가 완성됩니다.',
      tags: ['개발', '회고', 'TIL'],
      gradient: 'from-cyan-500 to-blue-500',
    },
    {
      avatar: '🔬',
      title: '논문 리서치를 블로그 시리즈로',
      description: 'AI와 브레인스토밍한 연구 내용을 체계적으로 정리하여 논문 작성 시간을 절반으로 단축합니다.',
      tags: ['연구', '논문', '리서치'],
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      avatar: '✨',
      title: '튜토리얼 제작 시간 대폭 단축',
      description: '아이디어 구상부터 콘텐츠 작성까지 대화로 해결하면, 제작 시간이 1/10로 줄어듭니다.',
      tags: ['튜토리얼', '교육', '생산성'],
      gradient: 'from-green-500 to-teal-500',
    },
  ];

  // 활용 방법 예시
  const usageExamples = [
    {
      icon: Code,
      title: '기술 블로그 자동화',
      description: '개발하면서 배운 내용을 즉시 포스팅',
      gradient: 'from-cyan-500 to-blue-500',
    },
    {
      icon: BookOpen,
      title: '학습 노트 아카이빙',
      description: 'AI와의 학습 대화를 지식 베이스로 저장',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: FileText,
      title: '프로젝트 문서화',
      description: '프로젝트 진행 과정을 자동으로 문서로 정리',
      gradient: 'from-green-500 to-teal-500',
    },
  ];

  return (
    <section className="py-32 px-4 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto">
        {/* 섹션 타이틀 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6">
            이렇게{' '}
            <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
              활용할 수 있습니다
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">
            실제 업무에 바로 적용 가능한 사례들
          </p>
        </motion.div>

        {/* 활용 사례 카드 */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20"
        >
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              whileHover={cardHover}
              className="group relative"
            >
              <div className="relative h-full bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* 배경 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${useCase.gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />

                {/* 콘텐츠 */}
                <div className="relative z-10 space-y-4">
                  {/* 아이콘 */}
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-3xl">
                      {useCase.avatar}
                    </div>
                  </div>

                  {/* 타이틀 */}
                  <h3 className="text-lg font-bold text-black dark:text-white leading-snug text-center">
                    {useCase.title}
                  </h3>

                  {/* 설명 */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-center">
                    {useCase.description}
                  </p>

                  {/* 태그 */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {useCase.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className={`px-3 py-1 bg-gradient-to-r ${useCase.gradient} bg-opacity-10 rounded-full text-xs font-semibold`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* 활용 방법 예시 */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8"
        >
          {usageExamples.map((example, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              className="relative group"
            >
              <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-800 hover:border-transparent transition-colors">
                {/* 아이콘 */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={defaultViewport}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="inline-block mb-4"
                >
                  <div className={`p-4 bg-gradient-to-br ${example.gradient} rounded-2xl shadow-lg`}>
                    <example.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                  </div>
                </motion.div>

                {/* 타이틀 */}
                <motion.h3
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={defaultViewport}
                  transition={{ duration: 0.6, delay: index * 0.1 + 0.2 }}
                  className={`text-xl font-bold bg-gradient-to-r ${example.gradient} bg-clip-text text-transparent mb-3`}
                >
                  {example.title}
                </motion.h3>

                {/* 설명 */}
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={defaultViewport}
                  transition={{ duration: 0.6, delay: index * 0.1 + 0.4 }}
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  {example.description}
                </motion.p>

                {/* 호버 시 배경 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${example.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
