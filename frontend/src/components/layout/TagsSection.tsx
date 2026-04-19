"use client";

import React from 'react';
import { FiHash } from 'react-icons/fi';
import SidebarSection from './SidebarSection';

interface TagsSectionProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  accentColor?: string;
  accentSoftColor?: string;
  className?: string;
}

const TagsSection = React.memo(function TagsSection({
  tags,
  onTagClick,
  accentColor,
  accentSoftColor,
  className,
}: TagsSectionProps) {
  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  // AI 태그를 맨 앞으로 정렬
  const sortedTags = [...tags];
  const aiIndex = sortedTags.findIndex(tag => tag.toLowerCase().startsWith('ai:'));
  if (aiIndex > -1) {
    const [aiTag] = sortedTags.splice(aiIndex, 1);
    sortedTags.unshift(aiTag);
  }

  return (
    <SidebarSection
      className={className}
      title={
        <div className="flex items-center gap-2">
          <FiHash className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span>Tags</span>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {sortedTags.map((tag, index) => {
          const isAITag = tag.toLowerCase().startsWith('ai:');
          return (
            <span
              key={index}
              onClick={() => handleTagClick(tag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTagClick(tag);
                }
              }}
              className="px-3 py-2 sm:px-2 sm:py-1 text-[15px] sm:text-[13px] cursor-pointer rounded-lg transition-colors min-h-[44px] sm:min-h-auto flex items-center border bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-black/30 dark:text-gray-300 dark:hover:bg-black/40 dark:hover:text-gray-200 border-gray-200 dark:border-gray-700"
              style={{
                borderColor: accentColor ? `${accentColor}33` : undefined,
                color: accentColor || undefined,
                backgroundColor: accentSoftColor || undefined,
              }}
              role="button"
              tabIndex={0}
              aria-label={`${tag} tag`}
            >
              #{tag}
            </span>
          );
        })}
        {tags.length === 0 && (
          <div className="text-center py-4 text-gray-500 w-full">
            <p className="text-[15px]">No tags yet.</p>
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default TagsSection; 
