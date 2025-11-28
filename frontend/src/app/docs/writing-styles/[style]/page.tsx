'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
            오류 발생
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/docs/writing-styles')}
            className="px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* 중앙 정렬 컨테이너 */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => router.push('/docs/writing-styles')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로 돌아가기
        </button>

        {/* 제목 섹션 */}
        <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {STYLE_NAMES[style] || style}
            </h1>
            {/* 복사 버튼 */}
            <button
              onClick={handleCopy}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">전체 복사</span>
                </>
              )}
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            이 가이드는 MCP 자동포스팅 서비스에서{' '}
            <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
              --{style}
            </code>{' '}
            플래그를 사용할 때 참고할 수 있는 템플릿입니다.
          </p>
        </div>

        {/* YAML Frontmatter 정보 */}
        {frontmatter && (
          <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              스타일 설정 (YAML Frontmatter)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {frontmatter.style_name && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">스타일 이름:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{frontmatter.style_name}</span>
                </div>
              )}
              {frontmatter.language && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">언어:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{frontmatter.language}</span>
                </div>
              )}
              {frontmatter.min_length && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">최소 길이:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{frontmatter.min_length}자</span>
                </div>
              )}
              {frontmatter.target_length && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">목표 길이:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{frontmatter.target_length}자</span>
                </div>
              )}
              {frontmatter.code_block_ratio && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">코드 블록 비율:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {(parseFloat(frontmatter.code_block_ratio) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {frontmatter.ai_tag_required && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">AI 태그 필수:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {frontmatter.ai_tag_required === 'true' ? '예' : '아니오'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 원본 마크다운 표시 */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              원본 마크다운
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              아래 내용을 복사하여 로컬에 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">.md</code> 파일로 저장하고, 원하는 대로 수정해서 사용하세요.
            </p>
          </div>

          <div className="relative">
            <pre className="bg-gray-900 dark:bg-black text-gray-100 p-6 rounded text-xs sm:text-sm overflow-x-auto font-mono leading-relaxed border border-gray-700 max-h-[600px] overflow-y-auto">
              <code>{rawMarkdown}</code>
            </pre>
          </div>

          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong>사용 팁:</strong> 위 템플릿을 참고하여 커스터마이징한 후,{' '}
              <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-xs">
                "이 스타일 가이드 + 위 내용을 참고해서 자동포스팅해줘"
              </code>{' '}
              라고 LLM에게 요청하면 훨씬 더 정교한 결과를 얻을 수 있습니다.
            </p>
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.push('/docs/writing-styles')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            모든 스타일 보기
          </button>
        </div>
      </div>
    </div>
  );
}
