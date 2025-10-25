'use client';

import { motion } from 'framer-motion';
import { Zap, MessageSquare, Brain, RefreshCw } from 'lucide-react';
import { staggerContainer, staggerItem, cardHover, defaultViewport } from '@/lib/animations/landing-animations';

/**
 * Value Proposition Section - 4가지 핵심 가치
 *
 * 사용자 답변 기반:
 * 1. 생산성 혁신
 * 2. 대화에서 콘텐츠로
 * 3. 학습 가속화
 * 4. 지식 재활용
 */
export default function ValueSection() {
  // 4가지 핵심 가치 데이터
  const values = [
    {
      icon: Zap,
      title: '생산성 혁신',
      subtitle: '글쓰기 시간 80% 단축',
      description: '대화만으로 완성도 높은 콘텐츠를 생성하세요. 글쓰기에 드는 시간을 대폭 줄이고, 사고와 창작에 집중할 수 있습니다.',
      gradient: 'from-yellow-500 to-orange-500',
      bgGradient: 'from-yellow-500/10 to-orange-500/10',
      iconBg: 'bg-yellow-500/20',
      stats: '평균 80% 시간 절약',
    },
    {
      icon: MessageSquare,
      title: '대화에서 콘텐츠로',
      subtitle: 'MCP 한 줄이면 끝',
      description: '"--tutorial", "--novel" 등 원하는 스타일로 즉시 변환. 같은 내용도 다양한 형태로 표현할 수 있습니다.',
      gradient: 'from-cyan-500 to-blue-500',
      bgGradient: 'from-cyan-500/10 to-blue-500/10',
      iconBg: 'bg-cyan-500/20',
      stats: '5가지 스타일 지원',
    },
    {
      icon: Brain,
      title: '학습 가속화',
      subtitle: '대화 히스토리 자동 정리',
      description: 'AI와 나눈 모든 대화가 체계적으로 정리됩니다. 과거 인사이트와 새로운 아이디어를 연결하며 학습을 가속화하세요.',
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-500/10 to-pink-500/10',
      iconBg: 'bg-purple-500/20',
      stats: '자동 태그 & 카테고리',
    },
    {
      icon: RefreshCw,
      title: '지식 재활용',
      subtitle: '흩어진 대화를 한곳에',
      description: '검색, 태그, 카테고리로 과거 대화를 쉽게 재발견하세요. 잊혀진 인사이트가 새로운 콘텐츠로 다시 태어납니다.',
      gradient: 'from-green-500 to-teal-500',
      bgGradient: 'from-green-500/10 to-teal-500/10',
      iconBg: 'bg-green-500/20',
      stats: '전문 검색 엔진',
    },
  ];

  return (
    <section className="py-32 px-4 bg-gradient-to-b from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
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
            왜{' '}
            <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
              Codebase.blog
            </span>
            인가?
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            AI 대화를 자산으로 만드는 4가지 핵심 가치
          </p>
        </motion.div>

        {/* 가치 카드 그리드 */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {values.map((value, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              whileHover={cardHover}
              className="relative group"
            >
              {/* 카드 컨테이너 */}
              <div className="relative h-full bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* 배경 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${value.bgGradient} opacity-50 group-hover:opacity-70 transition-opacity duration-300`} />

                {/* 콘텐츠 */}
                <div className="relative z-10 space-y-6">
                  {/* 번호 & 타이틀 & 부제 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-2xl font-bold bg-gradient-to-r ${value.gradient} bg-clip-text text-transparent`}>
                        {value.title}
                      </h3>
                      <div className="text-6xl font-bold text-gray-200 dark:text-gray-700">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                      {value.subtitle}
                    </p>
                  </div>

                  {/* 설명 */}
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {value.description}
                  </p>

                  {/* 통계/배지 */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {value.stats}
                        </span>
                      </div>
                      {index === 1 && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg shadow-sm border border-orange-200 dark:border-orange-800">
                          <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            사용자 커스터마이징 개발중
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 호버 시 빛나는 효과 */}
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-br ${value.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                />
              </div>

              {/* 카드 뒤 글로우 효과 */}
              <div className={`absolute -inset-1 bg-gradient-to-r ${value.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 -z-10`} />
            </motion.div>
          ))}
        </motion.div>

        {/* 추가 통계 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8"
        >
          {[
            { value: '10배', label: '생산성 향상' },
            { value: '92%', label: '시간 절약' },
            { value: '∞', label: '무한 아카이빙' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={defaultViewport}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="text-center"
            >
              <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-gray-600 dark:text-gray-400 font-semibold">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
