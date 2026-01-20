'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { CommunityRule } from '@/types/community';
import Linkify from 'linkify-react';

interface CommunityRulesListProps {
  rules: CommunityRule[];
  className?: string;
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
  /** 최대 표시 규칙 수 (접힌 상태) */
  maxCollapsed?: number;
  /** 헤더 표시 여부 */
  showHeader?: boolean;
  /** 헤더 타이틀 */
  headerTitle?: string;
  /** 번호 표시 여부 */
  showNumbering?: boolean;
}

// linkify-react 옵션
const linkifyOptions = {
  className: 'text-blue-600 dark:text-blue-400 hover:underline',
  target: '_blank',
  rel: 'noopener noreferrer',
};

/**
 * 커뮤니티 규칙 목록 컴포넌트
 * 사이드바에서 커뮤니티 규칙을 표시
 */
const CommunityRulesList = React.memo(function CommunityRulesList({
  rules,
  className,
  defaultExpanded = false,
  maxCollapsed = 3,
  showHeader = true,
  headerTitle = '커뮤니티 규칙',
  showNumbering = true,
}: CommunityRulesListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (defaultExpanded && rules?.length) {
      setIsExpanded(true);
      setExpandedRules(new Set(rules.map(rule => rule.id)));
    }
  }, [defaultExpanded, rules]);

  // 규칙이 없으면 렌더링하지 않음
  if (!rules || rules.length === 0) {
    return null;
  }

  // 정렬된 규칙 (displayOrder 기준)
  const sortedRules = [...rules].sort((a, b) => a.displayOrder - b.displayOrder);

  // 표시할 규칙
  const displayedRules = isExpanded ? sortedRules : sortedRules.slice(0, maxCollapsed);

  // 규칙 상세 토글
  const toggleRuleExpanded = (ruleId: string) => {
    setExpandedRules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-[rgb(38,38,38)] rounded-3xl border border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {/* 헤더 */}
      {showHeader && (
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <AlertCircle className="w-5 h-5 text-gray-500 dark:text-[#C7D1DD]" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {headerTitle}
          </h3>
          <span className="text-sm text-gray-500 dark:text-[#C7D1DD]">
            ({rules.length}개)
          </span>
        </div>
      )}

      {/* 규칙 목록 */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {displayedRules.map((rule, index) => {
          const isRuleExpanded = expandedRules.has(rule.id);

          return (
            <div key={rule.id} className="px-3 py-3">
              <button
                onClick={() => toggleRuleExpanded(rule.id)}
                className="w-full text-left flex items-start gap-3 group"
              >
                {/* 규칙 번호 */}
                {showNumbering && (
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#C7D1DD] text-sm font-medium flex items-center justify-center">
                    {index + 1}
                  </span>
                )}

                {/* 규칙 제목 */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {rule.title}
                  </h4>
                </div>

                {/* 확장 아이콘 */}
                {rule.description && (
                  <span className="flex-shrink-0 text-gray-400 dark:text-[#C7D1DD]">
                    {isRuleExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                )}
              </button>

              {/* 규칙 설명 (버튼 밖으로 분리하여 링크 클릭 가능하도록) */}
              {isRuleExpanded && rule.description && (
                <div className={cn("mt-2 text-sm text-gray-600 dark:text-[#C7D1DD] whitespace-pre-wrap", showNumbering ? "ml-9" : "ml-0")}>
                  <Linkify options={linkifyOptions}>
                    {rule.description}
                  </Linkify>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 더보기/접기 버튼 */}
      {rules.length > maxCollapsed && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-t border-gray-200 dark:border-gray-700"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 inline mr-1" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 inline mr-1" />
              모든 규칙 보기 ({rules.length - maxCollapsed}개 더)
            </>
          )}
        </button>
      )}
    </div>
  );
});

export default CommunityRulesList;
