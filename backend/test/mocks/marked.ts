class MockRenderer {
  parser = {
    parseInline: () => "",
  };

  code({ text }: { text: string }) {
    return text;
  }

  link() {
    return "";
  }
}

export const marked = {
  parse: (text: string) => text,
  use: () => undefined,
  Renderer: MockRenderer,
};
