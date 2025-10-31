import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { FiCheck } from 'react-icons/fi';

interface CommandItem {
  title: string;
  command: ({ editor, range }: any) => void;
  icon?: string;
}

const commands: CommandItem[] = [
  {
    title: '크게',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setFontSize('20px')
        .run();
    },
  },
  {
    title: '보통',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .unsetFontSize()
        .run();
    },
  },
  {
    title: '작게',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setFontSize('14px')
        .run();
    },
  },
  {
    title: '굵게',
    icon: 'B',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setMark('bold')
        .run();
    },
  },
  {
    title: '기울임',
    icon: 'I',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setMark('italic')
        .run();
    },
  },
  {
    title: '글머리 기호',
    icon: '•',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .run();
    },
  },
  {
    title: '번호 목록',
    icon: '1.',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleOrderedList()
        .run();
    },
  },
  {
    title: '인용구',
    icon: '"',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBlockquote()
        .run();
    },
  },
  {
    title: '코드 블록',
    icon: '</>',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock()
        .run();
    },
  },
  {
    title: '구분선',
    icon: '—',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHorizontalRule()
        .run();
    },
  },
  {
    title: '이미지',
    icon: '🖼',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // 이미지 업로드 트리거
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (file) {
          // 전역 이벤트로 이미지 업로드 요청
          const uploadEvent = new CustomEvent('editorImageUpload', { 
            detail: { file, editor } 
          });
          window.dispatchEvent(uploadEvent);
        }
      };
      fileInput.click();
    },
  },
];

export const CommandsList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 현재 에디터에 적용된 fontSize 가져오기
  const getCurrentFontSize = () => {
    const { fontSize } = props.editor.getAttributes('textStyle');
    return fontSize || '17px'; // 기본값 17px (보통)
  };

  // 각 커맨드가 현재 활성화되어 있는지 확인
  const isActive = (title: string) => {
    const currentSize = getCurrentFontSize();
    if (title === '크게') return currentSize === '20px';
    if (title === '보통') return currentSize === '17px';
    if (title === '작게') return currentSize === '14px';
    return false;
  };

  const selectItem = (index: number) => {
    const item = commands[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + commands.length - 1) % commands.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % commands.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [commands]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
      <div className="py-2">
        {commands.map((item, index) => {
          const active = isActive(item.title);
          return (
            <button
              className={`flex items-center justify-between w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
              } ${
                active ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              key={index}
              onClick={() => selectItem(index)}
            >
              <div className="flex items-center">
                <span className="flex items-center justify-center w-8 h-8 mr-3 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                  {item.icon}
                </span>
                <span className={`text-sm ${
                  active ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {item.title}
                </span>
              </div>
              {active && (
                <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

CommandsList.displayName = 'CommandsList';

export const suggestion = {
  items: ({ query }: { query: string }) => {
    return commands.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase())
    );
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: any = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(CommandsList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }

        return (component?.ref as any)?.onKeyDown(props);
      },

      onExit() {
        if (popup?.[0] && !popup[0].state.isDestroyed) {
          popup[0].destroy();
        }
        component?.destroy();
        popup = null;
        component = null;
      },
    };
  },
};