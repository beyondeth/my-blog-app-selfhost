'use client';

/**
 * MusicPlayerButton - 헤더용 음악 플레이어 버튼
 * ThemeSwitch와 동일한 스타일로 음악 재생 상태 표시
 *
 * 최적화 (v2):
 * - Header 리렌더링과 완전 분리
 * - useMusicStore에서 직접 상태 접근 (props 의존성 제거)
 * - React.memo로 불필요한 리렌더링 방지
 */

import * as React from 'react';
import { useMusicPlayerStatus } from '@/hooks/useMusicPlayer';
import { useMusicStore } from '@/stores/musicStore';

// Props 없이 자체적으로 상태 관리
function MusicPlayerButtonInner() {
  const { isPlaying, isLoading } = useMusicPlayerStatus();
  // Store에서 직접 상태 접근 (Header 리렌더링 영향 없음)
  const isOpen = useMusicStore((state) => state.isDropdownOpen);
  const toggleDropdown = useMusicStore((state) => state.toggleDropdown);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 마운트 전에는 placeholder 표시
  if (!mounted) {
    return <div className="w-9 h-9 rounded-full bg-muted/50 animate-pulse" />;
  }

  return (
    <button
      onClick={toggleDropdown}
      className={`p-2 flex items-center justify-center relative ${
        isOpen ? 'text-primary' : ''
      }`}
      aria-label={isPlaying ? '음악 일시정지' : '음악 재생'}
      aria-expanded={isOpen}
    >
      {/* 재생 중 애니메이션 인디케이터 */}
      {isPlaying && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>
      )}

      {/* 로딩 중 스피너 */}
      {isLoading ? (
        <svg
          className="w-5 h-5 animate-spin text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : isPlaying ? (
        // 재생 중: 음파 애니메이션 아이콘
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-green-500"
        >
          {/* 음파 바 3개 - 애니메이션 */}
          <rect
            x="4"
            y="8"
            width="3"
            height="8"
            rx="1"
            className="animate-[musicBar1_0.5s_ease-in-out_infinite]"
          />
          <rect
            x="10.5"
            y="5"
            width="3"
            height="14"
            rx="1"
            className="animate-[musicBar2_0.5s_ease-in-out_infinite_0.1s]"
          />
          <rect
            x="17"
            y="9"
            width="3"
            height="6"
            rx="1"
            className="animate-[musicBar3_0.5s_ease-in-out_infinite_0.2s]"
          />
        </svg>
      ) : (
        // 정지 상태: 음악 아이콘 (음표)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-gray-500 dark:text-gray-400"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )}
    </button>
  );
}

// React.memo로 래핑하여 불필요한 리렌더링 방지
// Zustand 선택자만 사용하므로 해당 상태가 변경될 때만 리렌더링
export const MusicPlayerButton = React.memo(MusicPlayerButtonInner);

export default MusicPlayerButton;
