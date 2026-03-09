"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FiBell } from 'react-icons/fi';
import SidebarSection from './SidebarSection';

/**
 * 프로모션 캐러셀 섹션 컴포넌트
 * @description 홈 화면 사이드바에서 2개의 프로모션을 자동 슬라이드로 보여주는 섹션
 * - 5초마다 자동 슬라이드 전환
 * - 좌→우 슬라이드 애니메이션
 * - 하단 인디케이터 dots
 * - 호버 시 자동 재생 일시정지
 * - 데스크톱 전용 (lg 이상)
 */
const PromoCarouselSection = React.memo(function PromoCarouselSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // 슬라이드 데이터
  const slides = [
    {
      id: 'mcp-auto-posting',
      icon: FiBell,
      title: 'MCP 자동 포스팅',
      description: 'AI 와 MCP 를 연결하여 Idea 를 자동으로 포스팅 할 수 있습니다.',
      ctaText: 'MCP 알아보기',
      ctaLink: '/landing',
      styles: [] as { name: string; emoji: string; color: string }[],
    },
    {
      id: 'writing-styles',
      icon: FiBell,
      title: 'Writing Styles',
      description: '현재 제공 중인 8개 스타일 가이드와 예시 프롬프트를 확인할 수 있습니다.',
      ctaText: '스타일 가이드 보기',
      ctaLink: '/docs/writing-styles',
      styles: [
        {
          name: 'Novel',
          emoji: '📖',
          color: 'bg-transparent text-[#4B5563] border border-[#D9E0EA] dark:border-[#4B5563] dark:text-[#C7D1DD]'
        },
        {
          name: 'PM',
          emoji: '🧭',
          color: 'bg-transparent text-[#4B5563] border border-[#D9E0EA] dark:border-[#4B5563] dark:text-[#C7D1DD]'
        },
        {
          name: 'Marketer',
          emoji: '📈',
          color: 'bg-transparent text-[#4B5563] border border-[#D9E0EA] dark:border-[#4B5563] dark:text-[#C7D1DD]'
        },
      ],
    },
  ];

  // 자동 슬라이드 (한 번만 전환: 첫 화면 → 두 번째 화면)
  useEffect(() => {
    if (isHovered) return; // 호버 시 정지
    if (currentSlide >= slides.length - 1) return; // 마지막 슬라이드면 정지

    const timeout = setTimeout(() => {
      setCurrentSlide((prev) => prev + 1);
    }, 5000);

    // 클린업
    return () => clearTimeout(timeout);
  }, [isHovered, currentSlide, slides.length]);

  // 인디케이터 클릭 핸들러
  const handleDotClick = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  return (
    <div className="hidden lg:block">
      <SidebarSection title={null}>
        {/* 캐러셀 컨테이너 */}
        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 슬라이드 래퍼 (overflow hidden) */}
          <div className="overflow-hidden">
            {/* 슬라이더 (flex로 가로 정렬) */}
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentSlide * 100}%)`,
              }}
            >
              {/* 각 슬라이드 */}
              {slides.map((slide) => {
                const Icon = slide.icon;
                return (
                  <div
                    key={slide.id}
                    className="w-full flex-shrink-0"
                  >
                    {/* 슬라이드 내용 */}
                    <div className="space-y-4">
                      {/* 아이콘 + 제목 */}
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-[#264653] dark:text-[#6CC3B2]" />
                        <h4 className="text-base font-semibold text-foreground">
                          {slide.title}
                        </h4>
                      </div>

                      {/* 설명 */}
                      <p className="text-sm text-[#4B5563] dark:text-[#C7D1DD] leading-relaxed">
                        {slide.description}
                      </p>

                      {/* Writing Styles의 경우 pill 표시 */}
                      {slide.styles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {slide.styles.map((style) => (
                            <span
                              key={style.name}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${style.color}`}
                            >
                              <span>{style.emoji}</span>
                              <span>{style.name}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* CTA */}
                      <Link
                        href={slide.ctaLink}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[#264653] dark:text-[#6CC3B2] hover:underline"
                      >
                        {slide.ctaText}
                        <span className="text-xs">→</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 인디케이터 (dots) */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`transition-all duration-300 rounded-full ${
                  currentSlide === index
                    ? 'w-6 h-2 bg-[#264653] dark:bg-[#6CC3B2]'
                    : 'w-2 h-2 bg-[#D9E0EA] dark:bg-[#2A3645] hover:bg-[#C9D3E0] dark:hover:bg-[#223040]'
                }`}
                aria-label={`슬라이드 ${index + 1}로 이동`}
              />
            ))}
          </div>
        </div>
      </SidebarSection>
    </div>
  );
});

export default PromoCarouselSection;
