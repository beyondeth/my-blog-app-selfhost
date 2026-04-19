'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronDown, BookOpen, Users, Check, Search } from 'lucide-react';
import { useMyCommunities } from '@/hooks/community';
import { cn } from '@/lib/utils';
import type { Community } from '@/types/community';
import { getOutsideClickEvent } from '@/utils/interaction';
import { useMobileOverlayReset } from '@/hooks/useMobileOverlayReset';

/**
 * 발행 대상 타입
 */
export type PublishTargetType = 'blog' | 'community';

/**
 * 발행 대상 정보
 */
type ImageFitMode = 'cover' | 'contain';

export interface PublishTarget {
  type: PublishTargetType;
  id: string;
  slug: string;
  name: string;
  iconUrl?: string;
  iconFit?: ImageFitMode;
}

/**
 * PublishTargetSelector Props
 */
interface PublishTargetSelectorProps {
  /** 현재 선택된 대상 */
  value: PublishTarget;
  /** 선택 변경 핸들러 */
  onChange: (target: PublishTarget) => void;
  /** 사용자의 블로그 정보 */
  userBlog: {
    id: string;
    slug: string;
    name: string;
    iconUrl?: string;
    iconImageFit?: ImageFitMode;
  };
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 글쓰기 위치 선택 컴포넌트
 *
 * @description 포스트를 발행할 위치(내 블로그 또는 가입한 커뮤니티)를 선택
 *
 * **특징:**
 * - 드롭다운 형식의 선택기
 * - 내 블로그와 가입한 커뮤니티 목록 표시
 * - 커뮤니티 검색 기능
 * - 아이콘/이미지 표시
 */
export default function PublishTargetSelector({
  value,
  onChange,
  userBlog,
  disabled = false,
}: PublishTargetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // 내가 가입한 커뮤니티 목록 조회
  const { data: myCommunities = [], isLoading: isLoadingCommunities } = useMyCommunities();

  // 검색된 커뮤니티 필터링
  const filteredCommunities = searchQuery
    ? myCommunities.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : myCommunities;

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const outsideEvent = getOutsideClickEvent();
    document.addEventListener(outsideEvent, handleClickOutside);
    return () => document.removeEventListener(outsideEvent, handleClickOutside);
  }, [closeDropdown]);

  useMobileOverlayReset(closeDropdown, isOpen);

  // 드롭다운 열릴 때 검색 입력란에 포커스
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 블로그 선택 핸들러
  const handleSelectBlog = () => {
    onChange({
      type: 'blog',
      id: userBlog.id,
      slug: userBlog.slug,
      name: userBlog.name,
      iconUrl: userBlog.iconUrl,
      iconFit: userBlog.iconImageFit,
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  // 커뮤니티 선택 핸들러
  const handleSelectCommunity = (community: Community) => {
    onChange({
      type: 'community',
      id: community.id,
      slug: community.slug,
      name: community.name,
      iconUrl: community.iconUrl,
      iconFit: community.iconImageFit,
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  // 현재 선택된 대상의 아이콘/이미지 렌더링
  const renderIcon = (
    type: PublishTargetType,
    iconUrl?: string,
    name?: string,
    iconFit: ImageFitMode = 'cover'
  ) => {
    if (iconUrl) {
      return (
        <Image
          src={iconUrl}
          alt={name || ''}
          width={20}
          height={20}
          className={cn(
            'rounded-full object-center',
            iconFit === 'contain' ? 'object-contain bg-white' : 'object-cover'
          )}
        />
      );
    }
    return type === 'blog' ? (
      <BookOpen className="w-5 h-5 text-gray-500" />
    ) : (
      <Users className="w-5 h-5 text-gray-500" />
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          'bg-gray-50 dark:bg-gray-800/70',
          'border-gray-300 dark:border-gray-600',
          'hover:border-gray-400 dark:hover:border-gray-500',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'border-gray-500 dark:border-gray-400'
        )}
      >
        {renderIcon(value.type, value.iconUrl, value.name, value.iconFit)}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
          {value.type === 'blog' ? 'My blog' : value.name}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-gray-200/80 dark:border-gray-700/80 shadow-xl z-50 overflow-hidden bg-gray-50/95 dark:bg-gray-900/90 backdrop-blur">
          {/* 검색 입력란 (커뮤니티가 5개 이상일 때만 표시) */}
          {myCommunities.length >= 5 && (
            <div className="p-2 border-b border-gray-200/80 dark:border-gray-700/60 bg-white/70 dark:bg-gray-900/80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search communities..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border-0 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
                />
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {/* 내 블로그 섹션 */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
              <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                My blog
              </p>
              <button
                type="button"
                onClick={handleSelectBlog}
                className={cn(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors',
                  'hover:bg-gray-100/80 dark:hover:bg-gray-800/70',
                  value.type === 'blog' && 'bg-gray-100/90 dark:bg-gray-800/80'
                )}
              >
                {renderIcon('blog', userBlog.iconUrl, userBlog.name, userBlog.iconImageFit)}
                <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {userBlog.name || userBlog.slug}
                </span>
                {value.type === 'blog' && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </button>
            </div>

            {/* 커뮤니티 섹션 */}
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Joined communities
              </p>

              {isLoadingCommunities ? (
                <div className="px-2 py-4 text-center text-sm text-gray-500">
                  Loading...
                </div>
              ) : filteredCommunities.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-gray-500">
                  {searchQuery ? 'No matching communities found.' : 'You have not joined any communities yet.'}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredCommunities.map((community) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => handleSelectCommunity(community)}
                      className={cn(
                        'w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors',
                        'hover:bg-gray-100 dark:hover:bg-gray-800',
                        value.type === 'community' &&
                          value.id === community.id &&
                          'bg-gray-100 dark:bg-gray-800'
                      )}
                    >
                      {renderIcon('community', community.iconUrl, community.name, community.iconImageFit)}
                      <div className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {community.name}
                        </span>
                        <span className="block text-xs text-gray-500 truncate">
                          c/{community.slug}
                        </span>
                      </div>
                      {value.type === 'community' && value.id === community.id && (
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
