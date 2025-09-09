/**
 * Slash Commands Extension
 * 슬래시 커맨드 기능을 제공하는 TipTap Extension
 */

import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { suggestion } from '../components/SlashCommands/SlashCommands';

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  
  addOptions() {
    return {
      suggestion,
    };
  },
  
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        ...this.options.suggestion,
      }),
    ];
  },
});