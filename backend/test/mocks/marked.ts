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
  parse: (text: string) =>
    text
      .replace(
        /^```([^\n]*)\n([\s\S]*?)\n```/gm,
        (_match, language: string, code: string) => {
          const escaped = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const className = language ? ` class="language-${language}"` : "";
          return `<pre><code${className}>${escaped}</code></pre>`;
        },
      )
      .replace(/^# (.+)$/gm, "<h1>$1</h1>"),
  use: () => undefined,
  Renderer: MockRenderer,
};
