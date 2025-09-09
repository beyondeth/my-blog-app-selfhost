/**
 * Custom YouTube Extension
 * TipTap 공식 YouTube extension을 참고하여 구현한 커스텀 버전
 */

import { Node, mergeAttributes, nodePasteRule, InputRule } from '@tiptap/core';
import { find } from 'linkifyjs';
import { Plugin, PluginKey, Transaction } from 'prosemirror-state';

export interface YoutubeOptions {
  addPasteHandler: boolean;
  allowFullscreen: boolean;
  autoplay: boolean;
  ccLanguage?: string;
  ccLoadPolicy?: boolean;
  controls: boolean;
  disableKBcontrols: boolean;
  enableIFrameApi: boolean;
  endTime: number;
  height: number;
  interfaceLanguage?: string;
  ivLoadPolicy: number;
  loop: boolean;
  modestBranding: boolean;
  HTMLAttributes: Record<string, any>;
  inline: boolean;
  nocookie: boolean;
  origin: string;
  playlist: string;
  progressBarColor?: string;
  startAt: number;
  width: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtube: {
      setYoutubeVideo: (options: {
        src: string;
        width?: number;
        height?: number;
        start?: number;
      }) => ReturnType;
    };
  }
}

// TipTap 공식 YouTube 정규식
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/(watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)?)([\w-]+)(&\S+)?$/;

const YOUTUBE_REGEX_GLOBAL = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/(watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)?)([\w-]+)(&\S+)?$/g;

function isValidYoutubeUrl(url: string) {
  return url.match(YOUTUBE_REGEX);
}

function getYoutubeVideoId(url: string) {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[6] : null;
}

function getEmbedUrlFromYoutubeUrl(url: string, options: Partial<YoutubeOptions>) {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;
  
  const params = [];
  const { startAt, endTime, autoplay, controls, loop, 
          modestBranding, ccLanguage, ccLoadPolicy, disableKBcontrols,
          enableIFrameApi, playlist, progressBarColor, interfaceLanguage } = options;
  
  if (startAt) params.push(`start=${startAt}`);
  if (endTime) params.push(`end=${endTime}`);
  if (autoplay) params.push('autoplay=1');
  if (!controls) params.push('controls=0');
  if (loop) params.push('loop=1');
  if (modestBranding) params.push('modestbranding=1');
  if (ccLanguage) params.push(`cc_lang_pref=${ccLanguage}`);
  if (ccLoadPolicy) params.push('cc_load_policy=1');
  if (disableKBcontrols) params.push('disablekb=1');
  if (enableIFrameApi) params.push('enablejsapi=1');
  if (progressBarColor) params.push(`color=${progressBarColor}`);
  if (interfaceLanguage) params.push(`hl=${interfaceLanguage}`);
  if (playlist || loop) params.push(`playlist=${playlist || videoId}`);
  
  const nocookie = options.nocookie ? '-nocookie' : '';
  const paramString = params.length ? `?${params.join('&')}` : '';
  
  return `https://www.youtube${nocookie}.com/embed/${videoId}${paramString}`;
}


export const CustomYoutube = Node.create<YoutubeOptions>({
  name: 'youtube',

  addOptions() {
    return {
      addPasteHandler: true,
      allowFullscreen: true,
      autoplay: false,
      controls: true,
      disableKBcontrols: false,
      enableIFrameApi: false,
      endTime: 0,
      height: 360,
      ivLoadPolicy: 0,
      loop: false,
      modestBranding: false,
      HTMLAttributes: {},
      inline: false,
      nocookie: false,
      origin: '',
      playlist: '',
      startAt: 0,
      width: 640,
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      originalUrl: {
        default: null,
        // Store the original YouTube URL for later use
        parseHTML: element => element.getAttribute('data-original-url'),
        renderHTML: attributes => {
          if (!attributes.originalUrl) return {};
          return { 'data-original-url': attributes.originalUrl };
        },
      },
      start: {
        default: 0,
      },
      width: {
        default: this.options.width,
      },
      height: {
        default: this.options.height,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
        getAttrs: (element) => {
          const iframe = (element as HTMLElement).querySelector('iframe');
          if (!iframe) return false;
          
          const src = iframe.getAttribute('src');
          if (!src) return false;
          
          // Extract video ID from embed URL
          const match = src.match(/embed\/([\w-]+)/);
          if (!match) return false;
          
          // Try to get the original URL from data attribute
          const originalUrl = (element as HTMLElement).getAttribute('data-original-url') 
            || `https://www.youtube.com/watch?v=${match[1]}`;
          
          return {
            src: originalUrl,
            originalUrl: originalUrl, // Preserve original URL when parsing
            width: iframe.getAttribute('width') || this.options.width,
            height: iframe.getAttribute('height') || this.options.height,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, width, height, originalUrl } = node.attrs;
    
    if (!src) {
      return ['div', { 'data-youtube-video': true }, 'No YouTube URL provided'];
    }
    
    const embedUrl = getEmbedUrlFromYoutubeUrl(src, {
      ...this.options,
      startAt: node.attrs.start || this.options.startAt,
    });
    
    if (!embedUrl) {
      return ['div', { 'data-youtube-video': true }, 'Invalid YouTube URL'];
    }
    
    // Include data-original-url in the rendered HTML
    const divAttrs: any = {
      'data-youtube-video': true,
      style: `position: relative; width: 100%; max-width: ${width}px;`,
    };
    
    // Preserve original URL in data attribute
    if (originalUrl) {
      divAttrs['data-original-url'] = originalUrl;
    }
    
    return [
      'div',
      mergeAttributes(
        this.options.HTMLAttributes,
        divAttrs,
        HTMLAttributes
      ),
      [
        'div',
        {
          style: `position: relative; padding-bottom: ${(height / width * 100).toFixed(2)}%; height: 0; overflow: hidden;`,
        },
        [
          'iframe',
          {
            src: embedUrl,
            width: '100%',
            height: '100%',
            frameborder: '0',
            allowfullscreen: this.options.allowFullscreen ? 'true' : 'false',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;',
          },
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (options) =>
        ({ commands, chain }) => {
          if (!isValidYoutubeUrl(options.src)) {
            return false;
          }
          
          // Store the original URL along with other attributes
          const attrs = {
            ...options,
            originalUrl: options.src, // Save original URL
          };
          
          // YouTube 노드 삽입 후 새 단락 추가
          // chain을 사용하여 순차적으로 실행
          const result = chain()
            .insertContent([
              {
                type: this.name,
                attrs,
              },
              {
                type: 'paragraph',
              }
            ])
            .focus() // 새 단락에 포커스
            .run();
          
          // YouTube 노드가 추가되면 이벤트 발생
          if (result) {
            console.log('[CustomYoutube] 📢 YouTube node added with proper cursor position');
            const event = new CustomEvent('youtubeEmbedAdded', {
              detail: { url: options.src }
            });
            window.dispatchEvent(event);
            console.log('[CustomYoutube] ✅ Event dispatched successfully');
          } else {
            console.log('[CustomYoutube] ❌ Failed to add YouTube node');
          }
          
          return result;
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        // YouTube URL이 입력되고 스페이스나 엔터가 눌리면 변환
        find: /((https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/(watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)?)([\w-]+)(&\S+)?)$/,
        handler: ({ state, range, match, commands }) => {
          const url = match[0];
          
          if (!isValidYoutubeUrl(url)) {
            return null;
          }
          
          const start = range.from;
          const end = range.to;
          
          // commands를 사용하여 YouTube 노드 삽입
          commands.deleteRange({ from: start, to: end });
          commands.insertContentAt(start, [
            {
              type: 'youtube',
              attrs: {
                src: url,
                originalUrl: url,
                width: this.options.width,
                height: this.options.height,
              }
            },
            {
              type: 'paragraph',
            }
          ]);
          
          // 이벤트 발생
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('youtubeEmbedAdded', {
              detail: { url }
            }));
          }, 0);
          
          return null;
        },
      }),
    ];
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) {
      return [];
    }

    return [
      nodePasteRule({
        find: (text: string) => {
          const foundLinks = find(text);
          const youtubeLinks = foundLinks.filter(link => isValidYoutubeUrl(link.value));
          
          return youtubeLinks.map(link => ({
            text: link.value,
            index: link.start,
            data: link.value,
          })) as any;
        },
        type: this.type,
        getAttributes: (match: any) => {
          console.log('[CustomYoutube] YouTube node added via paste');
          
          // YouTube 추가 후 커서를 다음 paragraph로 이동
          setTimeout(() => {
            const editor = (window as any).currentEditor;
            if (editor && !editor.isDestroyed) {
              // 에디터의 현재 상태를 확인하고 커서를 YouTube 노드 다음으로 이동
              const { state } = editor;
              const { doc, selection } = state;
              
              // YouTube 노드를 찾아서 그 다음 위치로 커서 이동
              let youtubePos: number | null = null;
              doc.descendants((node: any, pos: number) => {
                if (node.type.name === 'youtube' && youtubePos === null) {
                  // 가장 최근에 추가된 YouTube 노드 (보통 현재 커서 근처)
                  const distance = Math.abs(pos - selection.from);
                  if (distance < 100) { // 커서 근처의 YouTube 노드
                    youtubePos = pos + node.nodeSize;
                  }
                }
              });
              
              if (youtubePos !== null) {
                console.log('[CustomYoutube] Moving cursor after YouTube to position:', youtubePos);
                editor.chain()
                  .setTextSelection(youtubePos)
                  .focus()
                  .run();
              }
            }
            
            // 이벤트 발생 (갤러리 동기화용)
            window.dispatchEvent(new CustomEvent('youtubeEmbedAdded', {
              detail: { url: match.data }
            }));
          }, 50); // 짧은 지연 후 처리
          
          return {
            src: match.data,
            originalUrl: match.data,
            width: this.options.width,
            height: this.options.height,
          };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('youtube-paragraph'),
        appendTransaction: (transactions: readonly Transaction[], oldState: any, newState: any) => {
          const docChanged = transactions.some((tr: Transaction) => tr.docChanged);
          if (!docChanged) return null;
          
          const { tr } = newState;
          let modified = false;
          let newParagraphPos: number | null = null;
          
          // 새로 추가된 YouTube 노드를 찾아서 바로 뒤에 단락 추가
          newState.doc.descendants((node: any, pos: number) => {
            if (node.type.name === 'youtube') {
              const nextPos = pos + node.nodeSize;
              
              // nextPos가 문서 범위 내에 있는지 확인
              if (nextPos <= newState.doc.content.size) {
                const nextNode = newState.doc.nodeAt(nextPos);
                
                // YouTube 노드 다음에 아무것도 없거나 단락이 아닌 경우
                if (!nextNode || nextNode.type.name !== 'paragraph') {
                  // 이전 상태에서 같은 위치에 노드가 있는지 안전하게 확인
                  let isNewYouTube = true;
                  
                  // oldState의 문서 크기 확인
                  if (pos < oldState.doc.content.size) {
                    const oldNode = oldState.doc.nodeAt(pos);
                    if (oldNode && oldNode.type.name === 'youtube') {
                      isNewYouTube = false;
                    }
                  }
                  
                  if (isNewYouTube) {
                    tr.insert(nextPos, newState.schema.nodes.paragraph.create());
                    newParagraphPos = nextPos;
                    modified = true;
                  }
                } else if (nextNode && nextNode.type.name === 'paragraph') {
                  // YouTube 노드 다음에 paragraph가 이미 있는 경우
                  let isNewYouTube = true;
                  
                  // oldState의 문서 크기 확인
                  if (pos < oldState.doc.content.size) {
                    const oldNode = oldState.doc.nodeAt(pos);
                    if (oldNode && oldNode.type.name === 'youtube') {
                      isNewYouTube = false;
                    }
                  }
                  
                  if (isNewYouTube) {
                    // 새로 추가된 YouTube인 경우 커서를 paragraph로 이동
                    newParagraphPos = nextPos;
                    modified = true;
                  }
                }
              }
            }
          });
          
          // 새 paragraph가 추가되었거나 YouTube 다음 paragraph가 있으면 커서 이동
          if (newParagraphPos !== null && newParagraphPos < tr.doc.content.size) {
            try {
              // 커서를 새 paragraph의 시작 위치로 이동
              const resolvePos = Math.min(newParagraphPos + 1, tr.doc.content.size);
              const selection = newState.selection.constructor.near(
                tr.doc.resolve(resolvePos)
              );
              tr.setSelection(selection);
            } catch (error) {
              console.warn('[CustomYoutube] Failed to set selection:', error);
            }
          }
          
          return modified ? tr : null;
        },
      }),
    ];
  },
});