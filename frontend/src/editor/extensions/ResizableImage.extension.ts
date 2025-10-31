/**
 * Resizable Image Extension
 * 크기 조절 가능한 이미지 노드를 제공하는 TipTap Extension
 */

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageComponent } from '../components/ImageManager/ResizableImageNode';

export const ResizableImage = Image.extend({
  name: 'resizableImage',

  addAttributes() {
    return {
      // v3: Image extension의 기본 속성들 (src, alt, title)
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      // 커스텀 속성 추가
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('height'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      'data-image-id': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-image-id'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-image-id']) return {};
          return { 'data-image-id': attributes['data-image-id'] };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});