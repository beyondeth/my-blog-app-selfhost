'use client';

/**
 * GenreTab - 장르 탭 컴포넌트
 * 플레이리스트 드롭다운 내에서 장르별 필터링을 위한 탭 버튼
 */

import * as React from 'react';

// ============================================
// Props 인터페이스
// ============================================

interface GenreTabProps {
  /** 장르 라벨 */
  label: string;
  /** 활성화 상태 */
  isActive: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
}

// ============================================
// GenreTab 컴포넌트
// ============================================

/**
 * 단일 장르 탭 버튼
 * 활성화 시 녹색 배경, 비활성화 시 회색 배경
 */
export function GenreTab({ label, isActive, onClick }: GenreTabProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    // 이벤트 전파 차단 (드롭다운 닫힘 방지)
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onClick();
  };

  return (
    <button
      onMouseDown={handleMouseDown}
      className={`
        px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors
        ${
          isActive
            ? 'bg-green-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

// ============================================
// GenreTabs 컨테이너 컴포넌트
// ============================================

interface GenreTabsProps {
  /** 현재 선택된 장르 (null = 전체) */
  currentGenre: string | null;
  /** 사용 가능한 장르 목록 */
  availableGenres: readonly string[];
  /** 장르 변경 핸들러 */
  onGenreChange: (genre: string | null) => void;
}

/**
 * 장르 탭 목록 컨테이너
 * 가로 스크롤 지원, 전체 + 개별 장르 탭 표시
 */
export function GenreTabs({ currentGenre, availableGenres, onGenreChange }: GenreTabsProps) {
  // 장르가 없으면 렌더링하지 않음
  if (availableGenres.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1.5 p-2 border-b border-border overflow-x-auto scrollbar-hide">
      {/* 전체 탭 */}
      <GenreTab
        label="전체"
        isActive={currentGenre === null}
        onClick={() => onGenreChange(null)}
      />

      {/* 장르별 탭 */}
      {availableGenres.map((genre) => (
        <GenreTab
          key={genre}
          label={genre}
          isActive={currentGenre === genre}
          onClick={() => onGenreChange(genre)}
        />
      ))}
    </div>
  );
}

export default GenreTab;
