"use client";

import { Editor } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiBold,
  FiItalic,
  FiUnderline,
  FiList,
  FiImage,
  FiCode,
  FiChevronDown,
  FiCheck,
} from 'react-icons/fi';
import { 
  MdFormatListNumbered, 
  MdFormatQuote,
  MdHorizontalRule,
  MdFormatClear,
  MdFormatColorText,
  MdFormatColorFill
} from 'react-icons/md';

interface EnhancedEditorToolbarProps {
  editor: Editor | null;
  onImageUpload: () => void;
  isUploading?: boolean;
  hideImageButton?: boolean;
}

// 색상 프리셋
const COLOR_PRESETS = [
  { value: null, label: '기본' },
  { value: '#000000', label: '검정' },
  { value: '#434343', label: '진회색' },
  { value: '#666666', label: '회색' },
  { value: '#999999', label: '연회색' },
  { value: '#DC2626', label: '빨강' },
  { value: '#EA580C', label: '주황' },
  { value: '#CA8A04', label: '노랑' },
  { value: '#16A34A', label: '초록' },
  { value: '#0891B2', label: '하늘' },
  { value: '#2563EB', label: '파랑' },
  { value: '#7C3AED', label: '보라' },
  { value: '#DB2777', label: '분홍' },
];

// 배경색 프리셋 - 더 많은 색상 추가
const BG_COLOR_PRESETS = [
  { value: null, label: '기본' },
  // 하늘색 계열
  { value: '#7DD3FC', label: '하늘색' },  // sky-300
  { value: '#38BDF8', label: '진한 하늘' }, // sky-400
  { value: '#BAE6FD', label: '연한 하늘' }, // sky-200
  // 회색 계열
  { value: '#F3F4F6', label: '연회색' }, // gray-100
  { value: '#E5E7EB', label: '회색' }, // gray-200
  { value: '#D1D5DB', label: '진회색' }, // gray-300
  // 파스텔 계열
  { value: '#FEF3C7', label: '노랑' },
  { value: '#D1FAE5', label: '민트' },
  { value: '#FED7E2', label: '분홍' },
  { value: '#E9D5FF', label: '보라' },
  { value: '#FEE2E2', label: '연빨강' },
  { value: '#DBEAFE', label: '연파랑' }, // blue-100
  { value: '#C4EFFF', label: '연한 하늘' }, // user color light blue
  { value: '#DCE3E9', label: '연한 회색' }, // user color light gray
];

// 글꼴 크기 옵션 - 본문 전용 (17px 기본, 20px 강조)
const FONT_SIZES = [
  { value: '17px', label: '보통' },
  { value: '20px', label: '크게' },
];

export default function EnhancedEditorToolbar({
  editor,
  onImageUpload,
  isUploading = false,
  hideImageButton = false
}: EnhancedEditorToolbarProps) {
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);

  // 에디터 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleEditorClick = () => {
      setShowTextColorPicker(false);
      setShowBgColorPicker(false);
      setShowFontSizeMenu(false);
    };

    if (editor) {
      editor.on('focus', handleEditorClick);
      return () => {
        editor.off('focus', handleEditorClick);
      };
    }
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    children,
    title,
    className = ''
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
    className?: string;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          onClick();
        }
      }}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-all duration-150 ${
        isActive
          ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-100'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );

  const DropdownButton = ({ 
    label, 
    isOpen, 
    onClick,
    children 
  }: {
    label: string;
    isOpen: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className="px-3 py-2 text-sm flex items-center space-x-1 text-gray-700 hover:bg-gray-100 rounded transition-colors dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <span>{label}</span>
        <FiChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && children}
    </div>
  );

  const handleSetFontSize = (size: string) => {
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
    setShowFontSizeMenu(false);
  };

  const handleSetColor = (color: string | null) => {
    if (color) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    setShowTextColorPicker(false);
  };

  const handleSetHighlight = (color: string | null) => {
    if (color) {
      editor.chain().focus().setHighlight({ color }).run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
    setShowBgColorPicker(false);
  };



  return (
    <>
      {/* 데스크톱 툴바 */}
      <div className="hidden md:flex border-b border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-700 overflow-visible relative rounded-lg">
        <div className="flex items-center space-x-1 min-w-max">
          {/* 글꼴 크기 드롭다운 */}
          <DropdownButton
            label="글자"
            isOpen={showFontSizeMenu}
            onClick={() => {
              setShowFontSizeMenu(!showFontSizeMenu);
              setShowTextColorPicker(false);
              setShowBgColorPicker(false);
            }}
          >
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg" style={{ zIndex: 9999 }}>
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSetFontSize(size.value);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                  style={{ fontSize: size.value }}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </DropdownButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* 텍스트 서식 버튼들 */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="굵게 (Ctrl+B)"
          >
            <FiBold className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="기울임 (Ctrl+I)"
          >
            <FiItalic className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="밑줄 (Ctrl+U)"
          >
            <FiUnderline className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="취소선"
          >
            <span className="line-through">S</span>
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* 텍스트 색상 */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTextColorPicker(!showTextColorPicker);
                setShowBgColorPicker(false);
                setShowFontSizeMenu(false);
              }}
              title="텍스트 색상"
              className="p-2 rounded transition-all duration-150 relative text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
              style={{
                backgroundColor: editor.getAttributes('textStyle').color ?
                  `${editor.getAttributes('textStyle').color}20` : undefined
              }}
            >
              <MdFormatColorText className="w-4 h-4" />
            </button>
            {showTextColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg px-4 py-3" style={{ zIndex: 9999, width: '184px' }}>
                <div className="grid grid-cols-3 gap-2.5">
                  {COLOR_PRESETS.map((color) => {
                    const currentColor = editor.getAttributes('textStyle').color;
                    const isSelected = color.value === currentColor || (!color.value && !currentColor);
                    return (
                      <button
                        key={color.value || 'default'}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSetColor(color.value);
                        }}
                        className={`w-10 h-10 rounded hover:scale-110 transition-transform ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                            : 'border border-gray-300'
                        }`}
                        style={{ backgroundColor: color.value || '#ffffff' }}
                        title={color.label}
                      >
                        {!color.value && <span className="text-xs">×</span>}
                        {isSelected && color.value && (
                          <FiCheck className="w-3 h-3 text-white drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 배경색 (하이라이트) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowBgColorPicker(!showBgColorPicker);
                setShowTextColorPicker(false);
                setShowFontSizeMenu(false);
              }}
              title="배경색"
              className="p-2 rounded transition-all duration-150 relative text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
              style={{
                backgroundColor: editor.getAttributes('highlight').color || undefined
              }}
            >
              <MdFormatColorFill className="w-4 h-4" />
            </button>
            {showBgColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg px-4 py-3" style={{ zIndex: 9999, width: '184px' }}>
                <div className="grid grid-cols-3 gap-2.5">
                  {BG_COLOR_PRESETS.map((color) => {
                    const currentHighlight = editor.getAttributes('highlight').color;
                    const isSelected = color.value === currentHighlight || (!color.value && !currentHighlight);
                    return (
                      <button
                        key={color.value || 'default'}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSetHighlight(color.value);
                        }}
                        className={`w-10 h-10 rounded hover:scale-110 transition-transform ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                            : 'border border-gray-300'
                        }`}
                        style={{ backgroundColor: color.value || '#ffffff' }}
                        title={color.label}
                      >
                        {!color.value && <span className="text-xs">×</span>}
                        {isSelected && color.value && (
                          <FiCheck className="w-3 h-3 text-gray-700 drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* 목록 버튼들 */}
          <ToolbarButton
            onClick={() => {
              // 번호 목록이 활성화되어 있으면 먼저 해제
              if (editor.isActive('orderedList')) {
                editor.chain().focus().toggleOrderedList().run();
              }
              // 글머리 기호 토글
              editor.chain().focus().toggleBulletList().run();
            }}
            isActive={editor.isActive('bulletList')}
            title="글머리 기호"
          >
            <FiList className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => {
              // 글머리 기호가 활성화되어 있으면 먼저 해제
              if (editor.isActive('bulletList')) {
                editor.chain().focus().toggleBulletList().run();
              }
              // 번호 목록 토글
              editor.chain().focus().toggleOrderedList().run();
            }}
            isActive={editor.isActive('orderedList')}
            title="번호 목록"
          >
            <MdFormatListNumbered className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="인용구"
          >
            <MdFormatQuote className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="코드 블록"
          >
            <FiCode className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* 텍스트 정렬 버튼들 - 더 명확한 아이콘 사용 */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="왼쪽 정렬"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 10h10M3 14h18M3 18h10" />
            </svg>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="가운데 정렬"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M7 10h10M3 14h18M7 18h10" />
            </svg>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="오른쪽 정렬"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M11 10h10M3 14h18M11 18h10" />
            </svg>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            isActive={editor.isActive({ textAlign: 'justify' })}
            title="양쪽 정렬"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 10h18M3 14h18M3 18h18" />
            </svg>
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* 삽입 버튼들 */}
          {!hideImageButton && (
            <ToolbarButton
              onClick={onImageUpload}
              disabled={isUploading}
              title="이미지 업로드"
            >
              <FiImage className="w-4 h-4" />
            </ToolbarButton>
          )}



          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="구분선"
          >
            <MdHorizontalRule className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* 서식 지우기 */}
          <ToolbarButton
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            title="서식 지우기"
          >
            <MdFormatClear className="w-4 h-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* 모바일 툴바 - 768px 미만에서 표시 */}
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-700 overflow-visible relative rounded-lg">
        <div className="flex flex-nowrap items-center gap-3 justify-center">
          {/* 글자 크기 드롭다운 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowFontSizeMenu(!showFontSizeMenu);
              }}
              title="글자"
              className="p-2 rounded transition-all duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <span className="text-sm font-medium">글자</span>
            </button>
            {showFontSizeMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[9999] min-w-[120px]">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => {
                      handleSetFontSize(size.value);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 굵게 */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="굵게"
            className="min-w-[44px] min-h-[44px]"
          >
            <FiBold className="w-5 h-5" />
          </ToolbarButton>

          {/* 인용구 */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="인용구"
            className="min-w-[44px] min-h-[44px]"
          >
            <MdFormatQuote className="w-5 h-5" />
          </ToolbarButton>

          {/* 이미지 업로드 */}
          {!hideImageButton && (
            <ToolbarButton
              onClick={onImageUpload}
              disabled={isUploading}
              title="이미지"
              className="min-w-[44px] min-h-[44px]"
            >
              <FiImage className="w-5 h-5" />
            </ToolbarButton>
          )}

          {/* 구분선 */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="구분선"
            className="min-w-[44px] min-h-[44px]"
          >
            <MdHorizontalRule className="w-5 h-5" />
          </ToolbarButton>
        </div>
      </div>

    </>
  );
}