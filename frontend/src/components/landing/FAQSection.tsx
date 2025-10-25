'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fadeUp, defaultViewport } from '@/lib/animations/landing-animations';

/**
 * FAQ Section - 자주 묻는 질문
 *
 * 아코디언 형태로 사용자의 마지막 의심 해소
 */
export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // 첫 번째 항목 기본 오픈

  // FAQ 데이터
  const faqs = [
    {
      question: '어떤 LLM을 지원하나요?',
      answer: 'MCP 프로토콜을 지원하는 모든 LLM에서 사용 가능합니다.',
    },
    {
      question: 'MCP가 뭔가요? 어렵지 않나요?',
      answer: 'MCP (Model Context Protocol)는 AI 모델과 외부 도구를 연결하는 표준 프로토콜입니다. streamhttp 방식으로 사용하시는 IDE에 따라 설정하시면 됩니다.',
    },
    {
      question: '비공개 포스트도 가능한가요?',
      answer: '블로그 설정에서 포스트 공개/비공개 설정이 가능하며, 댓글 허용 또한 공개/비공개 설정이 가능합니다.',
    },
  ];

  // 아코디언 토글 핸들러
  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-32 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* 섹션 타이틀 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-black dark:text-white mb-6">
            자주 묻는 질문
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            궁금한 점이 있으신가요? 여기서 답을 찾아보세요
          </p>
        </motion.div>

        {/* FAQ 아코디언 */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={defaultViewport}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* 질문 헤더 */}
              <button
                onClick={() => toggleAccordion(index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-black dark:text-white pr-8">
                  {faq.question}
                </h3>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-6 h-6 text-gray-400" />
                </motion.div>
              </button>

              {/* 답변 콘텐츠 */}
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pt-0">
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
