/**
 * Video Embed Extension
 * 업로드된 비디오를 에디터에 임베드하는 TipTap Extension
 *
 * 기능:
 * - 비디오 노드 렌더링 (processing | ready | error 상태)
 * - 캡션 지원
 * - 고정 너비 685px (max-width: 100%)
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VideoNode } from '../components/Video/VideoNode';

export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

// TipTap Commands 타입 확장
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoEmbed: {
      /**
       * 비디오 노드 삽입
       */
      insertVideo: (options: {
        videoId: string;
        src?: string;
        status?: VideoStatus;
        caption?: string;
      }) => ReturnType;
      /**
       * 비디오 상태 업데이트 (videoId도 새 값으로 교체 가능)
       */
      updateVideoStatus: (videoId: string, status: VideoStatus, src?: string, newVideoId?: string) => ReturnType;
      /**
       * 비디오 캡션 설정
       */
      setVideoCaption: (videoId: string, caption: string) => ReturnType;
    };
  }
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      // 비디오 ID (백엔드 Video 엔티티 ID)
      'data-video-id': {
        default: null,
      },
      // 비디오 URL (ready 상태일 때만)
      src: {
        default: null,
      },
      // 처리 상태 (uploading | processing | ready | failed)
      status: {
        default: 'processing' as VideoStatus,
      },
      // 캡션
      caption: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        // figure 구조에서 파싱
        tag: 'figure[data-video-embed]',
        getAttrs: (dom: string | HTMLElement) => {
          if (typeof dom === 'string') return false;

          const video = dom.querySelector('video');
          return {
            'data-video-id': dom.getAttribute('data-video-id'),
            src: video?.getAttribute('src') || null,
            status: dom.getAttribute('data-status') || 'ready',
            caption: dom.querySelector('figcaption')?.textContent || '',
          };
        },
      },
      {
        // 단순 video 태그도 파싱 (기존 콘텐츠 호환성)
        tag: 'video[data-video-id]',
        getAttrs: (dom: string | HTMLElement) => {
          if (typeof dom === 'string') return false;

          return {
            'data-video-id': dom.getAttribute('data-video-id'),
            src: dom.getAttribute('src'),
            status: 'ready' as VideoStatus,
            caption: '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, caption, status } = HTMLAttributes;
    const videoId = HTMLAttributes['data-video-id'];

    // 처리 중인 경우 placeholder 렌더링
    if (status !== 'ready' || !src) {
      return [
        'figure',
        mergeAttributes(
          {
            'data-video-embed': '',
            'data-video-id': videoId,
            'data-status': status,
            class: 'video-embed-container',
          },
          HTMLAttributes,
        ),
        [
          'div',
          { class: 'video-processing-placeholder' },
          status === 'failed' ? '비디오 처리 실패' : '비디오 처리 중...',
        ],
        caption ? ['figcaption', {}, caption] : '',
      ];
    }

    // ready 상태: 실제 video 태그 렌더링
    return [
      'figure',
      mergeAttributes(
        {
          'data-video-embed': '',
          'data-video-id': videoId,
          'data-status': status,
          class: 'video-embed-container',
        },
        HTMLAttributes,
      ),
      [
        'video',
        {
          src,
          'data-video-id': videoId,
          controls: true,
          preload: 'metadata',
          style: 'width: 100%; max-width: 685px;',
        },
      ],
      caption ? ['figcaption', {}, caption] : '',
    ];
  },

  addCommands() {
    return {
      insertVideo:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              'data-video-id': options.videoId,
              src: options.src || null,
              status: options.status || 'processing',
              caption: options.caption || '',
            },
          });
        },

      updateVideoStatus:
        (videoId, status, src, newVideoId) =>
        ({ state, dispatch }) => {
          const { doc, tr } = state;
          let found = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs['data-video-id'] === videoId) {
              if (dispatch) {
                // 새 attrs 객체 생성 (src, newVideoId가 있으면 포함)
                const newAttrs = {
                  ...node.attrs,
                  'data-video-id': newVideoId || videoId,
                  status,
                  ...(src ? { src } : {}),
                };
                tr.setNodeMarkup(pos, undefined, newAttrs);
              }
              found = true;
              return false; // stop iteration
            }
            return true;
          });

          if (found && dispatch) {
            dispatch(tr);
          }

          return found;
        },

      setVideoCaption:
        (videoId, caption) =>
        ({ state, dispatch }) => {
          const { doc, tr } = state;
          let found = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs['data-video-id'] === videoId) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, caption });
              }
              found = true;
              return false;
            }
            return true;
          });

          if (found && dispatch) {
            dispatch(tr);
          }

          return found;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNode);
  },
});

export default VideoEmbed;
