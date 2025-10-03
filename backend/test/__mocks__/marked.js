// Mock implementation of marked for Jest tests
class MockRenderer {
  constructor() {
    // parser 속성 추가 (link renderer에서 사용)
    this.parser = {
      parseInline: (tokens) => '',
    };
  }
  code() { return ''; }
  blockquote() { return ''; }
  html() { return ''; }
  heading() { return ''; }
  hr() { return ''; }
  list() { return ''; }
  listitem() { return ''; }
  checkbox() { return ''; }
  paragraph() { return ''; }
  table() { return ''; }
  tablerow() { return ''; }
  tablecell() { return ''; }
  strong() { return ''; }
  em() { return ''; }
  codespan() { return ''; }
  br() { return ''; }
  del() { return ''; }
  link() { return ''; }
  image() { return ''; }
  text() { return ''; }
}

// marked 객체: 모든 필요한 메서드를 가진 객체
const markedMock = {
  parse: (text) => text,
  setOptions: jest.fn(),
  use: jest.fn(),
  Renderer: MockRenderer,
};

// Named export로 marked 제공
module.exports.marked = markedMock;

// ESM default export도 지원
module.exports.default = { marked: markedMock };
