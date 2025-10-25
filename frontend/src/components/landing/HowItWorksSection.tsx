'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Download, MessageSquare, Rocket, Copy, Check, Key } from 'lucide-react';
import { fadeUp, defaultViewport } from '@/lib/animations/landing-animations';

/**
 * How It Works Section - 4단계 가이드
 *
 * API-KEY 발급부터 포스팅까지의 과정을
 * 명확하고 간단하게 설명
 */
export default function HowItWorksSection() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  // MCP 설정 코드
  const mcpConfigCode = `{
  "mcpServers": {
    "codebase-blog-mcp": {
      "type": "http",
      "url": "https://mcp.codebase.blog/mcp",
      "headers": {
        "Authorization": "Bearer Your [API-KEY]"
      }
    }
  }
}
`;

  // 코드 복사 핸들러
  const handleCopyCode = (step: number) => {
    navigator.clipboard.writeText(mcpConfigCode);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  // 4단계 데이터
  const steps = [
    {
      icon: Key,
      number: '01',
      title: 'API-KEY 발급',
      subtitle: '1분이면 완료',
      description: '회원가입 후 설정 페이지에서 API-KEY를 발급받으세요. 발급받은 키는 안전하게 보관하세요.',
      gradient: 'from-purple-500 to-pink-500',
      content: (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold">1.</span>
                <span>회원가입 후 로그인</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold">2.</span>
                <span>헤더 오른쪽 상단 → 프로필 이미지 클릭 → API Keys</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold">3.</span>
                <span>API 키 생성 버튼 클릭</span>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200 font-semibold">
                  💡 발급받은 API-KEY는 다시 확인할 수 없으니 안전한 곳에 보관하세요!
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Download,
      number: '02',
      title: 'MCP 설치',
      subtitle: '3분이면 완료',
      description: 'Claude Code CLI에 MCP 서버를 연결하세요.',
      gradient: 'from-cyan-500 to-blue-500',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
              (Project Folder) VSCODE 환경이라면 .mcp.json 파일에 추가:
            </code>{' '}
            
          </p>
          <div className="relative">
            <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs sm:text-sm overflow-x-auto font-mono">
              {mcpConfigCode}
            </pre>
            <button
              onClick={() => handleCopyCode(2)}
              className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              {copiedStep === 2 ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      ),
    },
    {
      icon: MessageSquare,
      number: '03',
      title: '대화하기',
      subtitle: '평소처럼 자연스럽게',
      description: '평소처럼 Claude Code CLI와 대화하고, 인사이트가 떠오르면 바로 포스팅을 요청하세요.',
      gradient: 'from-purple-500 to-pink-500',
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">You</span>
              </div>
              <div className="flex-1">
                <div className="bg-cyan-600 text-white px-4 py-2 rounded-2xl rounded-tl-sm inline-block">
                  <p className="text-sm">위 내용 자동포스팅해줘 --tutorial</p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">AI</span>
              </div>
              <div className="flex-1">
                <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-2xl rounded-tl-sm inline-block">
                  <p className="text-sm">네, 튜토리얼 스타일로 작성하겠습니다! 🚀</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['--tutorial', '--novel', '--comedy', '--podcast', '--default'].map((style) => (
              <span
                key={style}
                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-mono font-semibold"
              >
                {style}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: Rocket,
      number: '04',
      title: '자동 발행',
      subtitle: '승인만 하면 끝',
      description: '생성된 포스트를 확인하고 승인하면 자동으로 블로그에 발행됩니다. 나중에 수정도 자유롭게 가능합니다.',
      gradient: 'from-green-500 to-teal-500',
      content: (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-black dark:text-white">Redis 캐싱 전략 완벽 가이드</h4>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                발행 완료
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded text-xs">#Redis</span>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs">#Caching</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="py-32 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* 섹션 타이틀 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6">
            간단한 4단계면{' '}
            <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
              시작할 수 있습니다
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">
            복잡한 설정 없이, 바로 사용 가능합니다
          </p>
        </motion.div>

        {/* 타임라인 */}
        <div className="relative">
          {/* 세로선 (데스크톱) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-cyan-500 to-green-500 transform -translate-x-1/2" />

          {/* 스텝 카드들 */}
          <div className="space-y-24">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={defaultViewport}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative flex flex-col lg:flex-row items-center gap-8 ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                }`}
              >
                {/* 콘텐츠 영역 */}
                <div className="flex-1 w-full">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-700">
                    {/* 헤더 */}
                    <div className="flex items-start gap-4 mb-6">
                      {/* 아이콘 */}
                      <div className={`p-4 bg-gradient-to-br ${step.gradient} rounded-2xl shadow-lg`}>
                        <step.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                      </div>

                      {/* 타이틀 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-5xl font-bold bg-gradient-to-r ${step.gradient} bg-clip-text text-transparent`}>
                            {step.number}
                          </span>
                          <h3 className="text-2xl font-bold text-black dark:text-white">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                          {step.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* 설명 */}
                    <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                      {step.description}
                    </p>

                    {/* 추가 콘텐츠 */}
                    <div>{step.content}</div>
                  </div>
                </div>

                {/* 중앙 원형 표시 (데스크톱) */}
                <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-16 h-16">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={defaultViewport}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                    className={`w-full h-full bg-gradient-to-br ${step.gradient} rounded-full flex items-center justify-center shadow-lg`}
                  >
                    <step.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                  </motion.div>
                </div>

                {/* 빈 공간 (레이아웃 밸런스) */}
                <div className="flex-1 hidden lg:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
