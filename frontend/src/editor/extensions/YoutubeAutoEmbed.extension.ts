/**
 * YouTube 자동 임베드 Extension
 * 스페이스바를 누를 때 YouTube URL을 자동으로 임베드로 변환
 */

import { Extension } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import { isYouTubeUrl, isEmbeddableYouTubeUrl, getYouTubeUrlType, extractYouTubeVideoId } from '../utils/youtube.utils';
import { toast } from 'sonner';

export const YoutubeAutoEmbed = Extension.create({
  name: 'youtubeAutoEmbed',
  
  addKeyboardShortcuts() {
    return {
      // 스페이스 키를 누를 때 YouTube URL 체크
      'Space': () => {
        const { selection, doc } = this.editor.state;
        const { from } = selection;
        
        // 커서 앞의 텍스트 가져오기 (최대 200자)
        const start = Math.max(0, from - 200);
        const textBefore = doc.textBetween(start, from, ' ', ' ');
        
        // YouTube URL 패턴 찾기 (더 넓은 범위의 URL 처리)
        const urlMatch = textBefore.match(/(https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+(?:&\S+)?)$/);
        
        if (urlMatch) {
          const url = urlMatch[1];
          const urlStart = from - url.length;
          
          // 임베드 가능한 URL인지 확인
          if (!isEmbeddableYouTubeUrl(url)) {
            const urlType = getYouTubeUrlType(url);
            if (urlType === 'channel') {
              toast.error('채널 URL은 임베드할 수 없습니다. 개별 동영상 URL을 입력해주세요.');
            } else if (urlType === 'playlist') {
              toast.error('플레이리스트 URL은 임베드할 수 없습니다. 개별 동영상 URL을 입력해주세요.');
            } else {
              toast.error('올바른 YouTube 동영상 URL이 아닙니다.');
            }
            return false; // 일반 스페이스 입력 계속
          }
          
          // URL을 YouTube 임베드로 교체
          const editor = this.editor;
          
          // YouTube와 paragraph를 삽입
          editor
            .chain()
            .deleteRange({ from: urlStart, to: from })
            .insertContent({
              type: 'youtube',
              attrs: {
                src: url,
                width: 685,
                height: 540,
              }
            })
            .insertContent({
              type: 'paragraph',
              content: []
            })
            .run();
          
          // 즉시 커서를 YouTube 다음으로 이동
          setTimeout(() => {
            const { state } = editor;
            const { doc } = state;
            
            // 방금 삽입한 YouTube 노드 찾기
            let youtubeEndPos: number | null = null;
            doc.descendants((node, pos) => {
              if (node.type.name === 'youtube' && node.attrs.src === url) {
                youtubeEndPos = pos + node.nodeSize;
                return false;
              }
            });
            
            if (youtubeEndPos !== null) {
              console.log('[YoutubeAutoEmbed] YouTube 변환 완료, 커서 강제 이동:', youtubeEndPos);
              // 커서를 YouTube 블록 바로 다음으로 이동
              editor.commands.setTextSelection(youtubeEndPos);
              editor.commands.focus();
            }
          }, 10); // 매우 짧은 지연만 사용
          
          // YouTube 썸네일 추가 이벤트 발생
          window.dispatchEvent(new CustomEvent('youtubeEmbedAdded', { 
            detail: { url, editor: this.editor } 
          }));
          
          toast.success('YouTube 동영상이 추가되었습니다.');
          return true; // 기본 스페이스 입력 방지
        }
        
        return false; // 일반 스페이스 입력 계속
      },
      
      // Enter 키를 누를 때도 YouTube URL 체크 (추가 편의성)
      'Enter': () => {
        const { selection, doc } = this.editor.state;
        const { from } = selection;
        
        // 현재 줄의 텍스트 가져오기
        const $pos = doc.resolve(from);
        const start = $pos.start($pos.depth);
        const end = from;
        const lineText = doc.textBetween(start, end, '', '').trim();
        
        // 전체 줄이 YouTube URL인지 확인
        if (lineText && isYouTubeUrl(lineText)) {
          // 임베드 가능한 URL인지 확인
          if (!isEmbeddableYouTubeUrl(lineText)) {
            const urlType = getYouTubeUrlType(lineText);
            if (urlType === 'channel') {
              toast.error('채널 URL은 임베드할 수 없습니다. 개별 동영상 URL을 입력해주세요.');
            } else if (urlType === 'playlist') {
              toast.error('플레이리스트 URL은 임베드할 수 없습니다. 개별 동영상 URL을 입력해주세요.');
            } else {
              toast.error('올바른 YouTube 동영상 URL이 아닙니다.');
            }
            return false; // 일반 Enter 동작 계속
          }
          
          // URL을 YouTube 임베드로 교체
          const editor = this.editor;
          
          // YouTube와 paragraph를 삽입
          editor
            .chain()
            .setTextSelection({ from: start, to: end })
            .deleteSelection()
            .insertContent({
              type: 'youtube',
              attrs: {
                src: lineText,
                width: 685,
                height: 540,
              }
            })
            .insertContent({
              type: 'paragraph',
              content: []
            })
            .run();
          
          // 즉시 커서를 YouTube 다음으로 이동
          setTimeout(() => {
            const { state } = editor;
            const { doc } = state;
            
            // 방금 삽입한 YouTube 노드 찾기
            let youtubeEndPos: number | null = null;
            doc.descendants((node, pos) => {
              if (node.type.name === 'youtube' && node.attrs.src === lineText) {
                youtubeEndPos = pos + node.nodeSize;
                return false;
              }
            });
            
            if (youtubeEndPos !== null) {
              console.log('[YoutubeAutoEmbed Enter] YouTube 변환 완료, 커서 강제 이동:', youtubeEndPos);
              // 커서를 YouTube 블록 바로 다음으로 이동
              editor.commands.setTextSelection(youtubeEndPos);
              editor.commands.focus();
            }
          }, 10); // 매우 짧은 지연만 사용
          
          // YouTube 썸네일 추가 이벤트 발생
          window.dispatchEvent(new CustomEvent('youtubeEmbedAdded', { 
            detail: { url: lineText, editor: this.editor } 
          }));
          
          toast.success('YouTube 동영상이 추가되었습니다.');
          return true;
        }
        
        return false;
      },
    };
  },
});