"use client";

import React from 'react';
import SidebarSection from './SidebarSection';

interface TagsSectionProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
}

const TagsSection = React.memo(function TagsSection({ tags, onTagClick }: TagsSectionProps) {
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
    <SidebarSection title="태그">
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
              className={`px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs cursor-pointer rounded-md sm:rounded-none transition-colors min-h-[44px] sm:min-h-auto flex items-center ${
                isAITag
                  ? 'bg-pink-100 text-pink-700 hover:bg-pink-200 hover:text-pink-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-100 hover:text-gray-800'
              }`}
              role="button"
              tabIndex={0}
              aria-label={`${tag} 태그`}
            >
              #{tag}
            </span>
          );
        })}
        {tags.length === 0 && (
          <div className="text-center py-4 text-gray-500 w-full">
            <p className="text-sm">태그가 없습니다.</p>
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default TagsSection; 