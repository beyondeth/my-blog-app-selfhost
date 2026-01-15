'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_PAGE_WRAPPER,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';

/**
 * Writing Style 상세 페이지
 *
 * 개별 스타일의 원본 마크다운 가이드를 표시하고 복사 기능 제공
 */

const VALID_STYLES = ['default', 'novel', 'tutorial', 'comedy', 'podcast', 'vibe', '_common'];

const STYLE_NAMES: Record<string, string> = {
  default: 'Default - 전문적인 기술 블로그',
  novel: 'Novel - 서사적인 스토리텔링',
  tutorial: 'Tutorial - 단계별 튜토리얼',
  comedy: 'Comedy - 유머러스한 경험 공유',
  podcast: 'Podcast - 대화형 팟캐스트',
  vibe: 'Vibe - 개발자 학습 가이드',
  _common: 'Common Rules - 공통 규칙',
};

export default function WritingStyleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const style = params.style as string;

  const [rawMarkdown, setRawMarkdown] = useState<string>(''); // 원본 마크다운
  const [frontmatter, setFrontmatter] = useState<Record<string, any> | null>(null); // YAML frontmatter
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); // 복사 상태

  // YAML frontmatter 파싱 함수
  const parseFrontmatter = (markdown: string) => {
    const match = markdown.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const yamlText = match[1];
    const frontmatterData: Record<string, any> = {};

    // YAML 수동 파싱 (간단한 key: value 형태)
    yamlText.split('\n').forEach((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim().replace(/['"]/g, '');
        frontmatterData[key] = value;
      }
    });

    return frontmatterData;
  };

  // 복사 버튼 핸들러
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 마크다운 파일 로드
  useEffect(() => {
    const loadDocument = async () => {
      // 유효한 스타일인지 확인
      if (!VALID_STYLES.includes(style)) {
        setError('존재하지 않는 스타일입니다.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const filePath = `/docs/writing-styles/${style}.md`;
        const response = await fetch(filePath);

        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const markdown = await response.text();
        setRawMarkdown(markdown); // 원본 마크다운 저장

        // YAML frontmatter 파싱
        const parsedFrontmatter = parseFrontmatter(markdown);
        setFrontmatter(parsedFrontmatter);
      } catch (err) {
        console.error('Error loading writing style document:', err);
        setError('문서를 불러오는데 실패했습니다. 나중에 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [style]);

  // 로딩 상태
  if (loading) {
    return (
      <div className={`${SETTINGS_PAGE_WRAPPER} flex items-center justify-center py-20`}>
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-900 dark:border-[#2F3440] dark:border-t-white mx-auto" />
          <p className="text-sm text-gray-600 dark:text-gray-300">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className={`${SETTINGS_PAGE_WRAPPER} flex items-center justify-center py-20`}>
        <div className={`${SETTINGS_CARD_CLASS} max-w-md w-full p-6 text-center space-y-4`}>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">오류 발생</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button onClick={() => router.push('/docs/writing-styles')} className={SETTINGS_PRIMARY_BUTTON_CLASS}>
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${SETTINGS_PAGE_WRAPPER} pb-16`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <button
          onClick={() => router.push('/docs/writing-styles')}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로 돌아가기
        </button>

        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8 space-y-4`}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Writing Style</p>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{STYLE_NAMES[style] || style}</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              MCP 자동포스팅에서{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#1F2229] rounded text-sm font-mono">--{style}</code> 플래그를 사용할 때 참고하세요.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleCopy} className={`${SETTINGS_PRIMARY_BUTTON_CLASS} flex items-center gap-2`}>
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  전체 복사
                </>
              )}
            </button>
            <button
              onClick={() => router.push('/docs/writing-styles')}
              className={`${SETTINGS_SUBTLE_BUTTON_CLASS} flex items-center gap-2`}
            >
              <ArrowLeft className="w-4 h-4" />
              다른 스타일 살펴보기
            </button>
          </div>
        </section>

        {frontmatter && (
          <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8 space-y-4`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">스타일 설정 (YAML frontmatter)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {frontmatter.style_name && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">스타일 이름</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{frontmatter.style_name}</p>
                </div>
              )}
              {frontmatter.language && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">언어</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{frontmatter.language}</p>
                </div>
              )}
              {frontmatter.min_length && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">최소 길이</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{frontmatter.min_length}자</p>
                </div>
              )}
              {frontmatter.target_length && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">목표 길이</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{frontmatter.target_length}자</p>
                </div>
              )}
              {frontmatter.code_block_ratio && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">코드 블록 비율</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {(parseFloat(frontmatter.code_block_ratio) * 100).toFixed(0)}%
                  </p>
                </div>
              )}
              {frontmatter.ai_tag_required && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">AI 태그 필수</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {frontmatter.ai_tag_required === 'true' ? '예' : '아니오'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className={`${SETTINGS_CARD_CLASS} p-6 sm:p-8 space-y-4`}>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">원본 마크다운</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              아래 내용을 복사해 로컬 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#1F2229] rounded font-mono text-xs">.md</code> 파일로 저장한 뒤 자유롭게
              수정하세요.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-[#2F3440] overflow-hidden">
            <pre className="bg-gray-950 text-gray-100 p-6 text-xs sm:text-sm overflow-x-auto font-mono leading-relaxed max-h-[600px]">
              <code>{rawMarkdown}</code>
            </pre>
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-[#2F3440] bg-gray-50 dark:bg-[#1F2229] p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <span className="font-semibold text-gray-900 dark:text-white">사용 팁:</span> 위 템플릿을 커스터마이징한 뒤{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#1F2229] rounded text-xs font-mono">
                이 스타일 가이드 + 위 내용을 참고해서 자동포스팅해줘
              </code>
              라고 요청하면 훨씬 더 정교한 결과를 얻을 수 있습니다.
            </p>
          </div>
        </section>

        <div className="flex justify-start">
          <button onClick={() => router.push('/docs/writing-styles')} className={`${SETTINGS_SUBTLE_BUTTON_CLASS} flex items-center gap-2`}>
            <ArrowLeft className="w-4 h-4" />
            모든 스타일 보기
          </button>
        </div>
      </div>
    </div>
  );
}
