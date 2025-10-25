/**
 * 랜딩페이지 애니메이션 설정
 * Framer Motion 기반 애니메이션 variants 및 유틸리티
 */

import { Variants } from 'framer-motion';

/**
 * 페이드 업 애니메이션 (아래에서 위로 부드럽게 등장)
 */
export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 50
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1], // cubic-bezier
    }
  }
};

/**
 * 스태거 컨테이너 (자식 요소들을 순차적으로 등장)
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, // 0.2초 간격
      delayChildren: 0.1,
    }
  }
};

/**
 * 스태거 아이템
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    }
  }
};

/**
 * 스케일 업 애니메이션 (작게 시작해서 커짐)
 */
export const scaleUp: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    }
  }
};

/**
 * 좌측에서 슬라이드 인
 */
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -60
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: [0.4, 0, 0.2, 1],
    }
  }
};

/**
 * 우측에서 슬라이드 인
 */
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 60
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: [0.4, 0, 0.2, 1],
    }
  }
};

/**
 * Glassmorphism 카드 호버 효과
 */
export const cardHover = {
  scale: 1.03,
  y: -8,
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
  transition: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 20,
  }
};

/**
 * 타이핑 효과 - 글자별 딜레이
 */
export const typingContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 글자 간격
      delayChildren: 0.1,
    }
  }
};

export const typingItem: Variants = {
  hidden: {
    opacity: 0,
    y: 10
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    }
  }
};

/**
 * 공통 viewport 설정
 */
export const defaultViewport = {
  once: true, // 한 번만 애니메이션
  amount: 0.3, // 30% 보일 때 트리거
  margin: '0px 0px -100px 0px', // 하단 100px 여유
};
