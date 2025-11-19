/**
 * Medium Style Image Extension
 * Medium 스타일 이미지 노드를 제공하는 TipTap Extension
 *
 * 기능:
 * - 4가지 크기 옵션 (small: 300px, medium: 500px, default: 680px, full: 1000px)
 * - Caption 지원 (이미지 설명)
 * - 썸네일 선택 (data-image-id)
 */

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MediumImageNode } from '../components/MediumImage/MediumImageNode';

export type ImageSize = 'small' | 'medium' | 'default' | 'full';

export const MediumStyleImage = Image.extend({
  name: 'mediumImage',

  group: 'block',

  addAttributes() {
    return {
      // 기본 Image 속성
      src: {
        default: null,
      },

      // 이미지 크기
      size: {
        default: 'default',
      },

      // Caption (이미지 설명)
      caption: {
        default: '',
      },

      // 썸네일 ID (썸네일 선택 기능)
      'data-image-id': {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        // figure 구조에서 파싱
        tag: 'figure[data-medium-image]',
        getAttrs: (dom: string | HTMLElement) => {
          if (typeof dom === 'string') return false;

          const img = dom.querySelector('img');
          if (!img) return false;

          return {
            src: img.getAttribute('src'),
            size: img.getAttribute('data-size') || 'default',
            caption: dom.querySelector('figcaption')?.textContent || '',
            'data-image-id': img.getAttribute('data-image-id'),
          };
        },
      },
      {
        // 레거시 img 태그도 파싱 (기존 콘텐츠 호환성)
        tag: 'img[src]',
        getAttrs: (dom: string | HTMLElement) => {
          if (typeof dom === 'string') return false;

          return {
            src: dom.getAttribute('src'),
            size: dom.getAttribute('data-size') || 'default',
            caption: '',
            'data-image-id': dom.getAttribute('data-image-id'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    const { src, size, caption } = HTMLAttributes;
    const imageId = HTMLAttributes['data-image-id'];

    // figure 구조로 렌더링
    const imgAttrs: Record<string, any> = {
      src,
      alt: '',
      'data-size': size,
      class: `medium-image medium-image-${size}`,
    };

    if (imageId) {
      imgAttrs['data-image-id'] = imageId;
    }

    // caption이 있으면 figcaption 포함
    const children: any[] = [
      ['img', imgAttrs],
    ];

    if (caption) {
      children.push(['figcaption', { class: 'medium-image-caption' }, caption]);
    }

    return [
      'figure',
      { 'data-medium-image': '', class: 'medium-image-wrapper' },
      ...children,
    ];
  },

  // NodeView에서 DOM 생성을 제어하기 위한 toDOM 메소드
  toDOM(node: any) {
    const { src, size, caption, 'data-image-id': imageId } = node.attrs;

    // figure 요소 생성
    const figure = document.createElement('figure');
    figure.setAttribute('data-medium-image', '');
    figure.className = 'medium-image-wrapper';

    // img 요소 생성
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.setAttribute('data-size', size || 'default');
    img.className = `medium-image medium-image-${size || 'default'}`;

    if (imageId) {
      img.setAttribute('data-image-id', imageId);
    }

    figure.appendChild(img);

    // caption이 있으면 figcaption 생성
    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.className = 'medium-image-caption';
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }

    return figure;
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediumImageNode);
  },

  // 커맨드 추가: 이미지 크기 변경
  addCommands() {
    return {
      setImageSize:
        (size: ImageSize) =>
        ({ commands }: any) => {
          return commands.updateAttributes(this.name, { size });
        },
      setImageCaption:
        (caption: string) =>
        ({ commands }: any) => {
          return commands.updateAttributes(this.name, { caption });
        },
    };
  },
});
