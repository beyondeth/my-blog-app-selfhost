import { Injectable } from "@nestjs/common";
import { marked } from "marked";
import { JSDOM } from "jsdom";

type ImageSize = "small" | "medium" | "default" | "full";

@Injectable()
export class MarkdownRendererService {
  constructor() {
    marked.use({
      gfm: true,
      breaks: false,
      pedantic: false,
    });

    // 커스텀 렌더러 설정 - 최소한의 처리만
    const renderer = new marked.Renderer();

    // 코드 블록: language 클래스만 추가 (highlight.js를 위해)
    renderer.code = function ({ text, lang }) {
      const language = lang || "";
      const escapedCode = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Mermaid 블록은 명시적으로 처리 (프론트엔드 렌더링용)
      if (language === "mermaid") {
        return `<pre><code class="language-mermaid">${escapedCode}</code></pre>`;
      }

      // 기타 언어 코드 블록
      if (language) {
        return `<pre><code class="language-${language}">${escapedCode}</code></pre>`;
      }

      // 언어 지정 없는 코드 블록
      return `<pre><code>${escapedCode}</code></pre>`;
    };

    // 링크: 외부 링크에 target="_blank" 추가
    renderer.link = function ({ href, title, tokens }) {
      const text = this.parser?.parseInline(tokens) || "";
      const isExternal =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//");
      const targetAttr = isExternal
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      const titleAttr = title ? ` title="${title}"` : "";
      return `<a href="${href}"${titleAttr}${targetAttr}>${text}</a>`;
    };

    marked.use({ renderer });
  }

  convertToHtml(text: string): string {
    /**
     * 표준 marked 라이브러리를 사용한 마크다운 → HTML 변환
     * 모든 복잡한 파싱 로직은 marked가 처리
     */

    // 개발 환경에서 Mermaid 블록 입력 확인 (디버깅용)
    if (process.env.NODE_ENV === "development" && text.includes("```mermaid")) {
      const mermaidMatches = text.match(/```mermaid[\s\S]*?```/g);
      if (mermaidMatches) {
        console.log(
          "[Markdown Renderer] Mermaid blocks detected:",
          mermaidMatches.length,
        );
        console.log(
          "[Markdown Renderer] First block preview:",
          mermaidMatches[0].substring(0, 100) + "...",
        );
      }
    }

    const { protectedText, tokens } = this.protectImageAttributeBlocks(text);
    const html = marked.parse(protectedText) as string;
    const restoredHtml = this.restoreImageAttributeBlocks(html, tokens);
    const enhancedHtml = this.applyExtendedImageAttributes(restoredHtml);

    // 개발 환경에서 변환 결과 확인 (디버깅용)
    if (process.env.NODE_ENV === "development" && text.includes("```mermaid")) {
      const hasLanguageMermaid = enhancedHtml.includes("language-mermaid");
      console.log(
        "[Markdown Renderer] Output contains language-mermaid:",
        hasLanguageMermaid,
      );
      if (!hasLanguageMermaid) {
        console.warn(
          "[Markdown Renderer] WARNING: Mermaid blocks not properly converted!",
        );
        console.log(
          "[Markdown Renderer] Output preview:",
          enhancedHtml.substring(0, 300),
        );
      }
    }

    return enhancedHtml;
  }

  private protectImageAttributeBlocks(markdown: string): {
    protectedText: string;
    tokens: Array<{ token: string; attrs: string }>;
  } {
    if (!markdown) {
      return { protectedText: markdown, tokens: [] };
    }

    const tokens: Array<{ token: string; attrs: string }> = [];
    const pattern = /!\[[^\]]*]\([^)]+\)\s*(\{[^}]*\})/g;
    let protectedText = markdown;

    protectedText = protectedText.replace(pattern, (match, attrs) => {
      const token = `<!--IMG_ATTR_TOKEN_${tokens.length}-->`;
      tokens.push({ token, attrs });
      return match.replace(attrs, token);
    });

    return { protectedText, tokens };
  }

  private restoreImageAttributeBlocks(
    html: string,
    tokens: Array<{ token: string; attrs: string }>,
  ): string {
    if (!html || tokens.length === 0) {
      return html;
    }

    let restored = html;
    tokens.forEach(({ token, attrs }) => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      restored = restored.replace(new RegExp(escaped, "g"), attrs);
    });

    return restored;
  }

  private applyExtendedImageAttributes(html: string): string {
    if (!html) return html;
    if (
      !html.includes("{#") &&
      !html.includes("size=") &&
      !html.includes("caption=")
    ) {
      return html;
    }

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const { Node } = dom.window;
      const attrPattern = /^\s*\{([^}]+)\}\s*$/;

      const images = Array.from(document.querySelectorAll("img"));
      images.forEach((img) => {
        const parent = img.parentElement;
        if (!parent) return;

        const container =
          parent.tagName === "A" ? parent.parentElement : parent;
        if (!container) return;

        const attrNode = Array.from(container.childNodes).find((node) => {
          return (
            node.nodeType === Node.TEXT_NODE &&
            attrPattern.test(node.textContent || "")
          );
        });

        if (!attrNode || !attrNode.textContent) return;

        const match = attrNode.textContent.match(attrPattern);
        if (!match) return;

        const metadata = this.parseImageAttributes(match[1]);
        if (!metadata.id && !metadata.size && !metadata.caption) return;

        const size = metadata.size || "default";
        if (!img.getAttribute("data-size")) {
          img.setAttribute("data-size", size);
        }
        this.addClasses(img, "medium-image", `medium-image-${size}`);
        if (metadata.id) {
          img.setAttribute("data-image-id", metadata.id);
        }

        if (parent.tagName === "A") {
          const linkWrapper = parent;
          const linkParent = linkWrapper.parentElement;
          if (linkParent) {
            linkParent.insertBefore(img, linkWrapper);
            linkWrapper.remove();
          }
        }

        const captionText = metadata.caption?.trim() || "";
        const effectiveParent = img.parentElement;
        if (!effectiveParent) {
          attrNode.remove();
          return;
        }

        if (effectiveParent.tagName === "FIGURE") {
          effectiveParent.setAttribute("data-medium-image", "");
          this.addClasses(effectiveParent, "medium-image-wrapper");
          if (captionText) {
            let figcaption = effectiveParent.querySelector("figcaption");
            if (!figcaption) {
              figcaption = document.createElement("figcaption");
              figcaption.className = "medium-image-caption";
              effectiveParent.appendChild(figcaption);
            }
            this.setCaptionContent(figcaption, captionText, document);
          }
          attrNode.remove();
          return;
        }

        const isSafeParagraph =
          effectiveParent.tagName === "P" &&
          Array.from(effectiveParent.childNodes).every((node) => {
            if (node === img || node === attrNode) return true;
            if (node.nodeType === Node.TEXT_NODE) {
              return !(node.textContent || "").trim();
            }
            return false;
          });

        if (isSafeParagraph) {
          const figure = document.createElement("figure");
          figure.setAttribute("data-medium-image", "");
          figure.className = "medium-image-wrapper";
          figure.appendChild(img);
          if (captionText) {
            const figcaption = document.createElement("figcaption");
            figcaption.className = "medium-image-caption";
            this.setCaptionContent(figcaption, captionText, document);
            figure.appendChild(figcaption);
          }
          effectiveParent.replaceWith(figure);
          return;
        }

        // 캡션을 안전하게 figure 내부에 둘 수 없는 경우, 링크/캡션은 생성하지 않음
        attrNode.remove();
      });

      return document.body.innerHTML;
    } catch (error) {
      console.warn(
        "[Markdown Renderer] Failed to apply image attributes:",
        error,
      );
      return html;
    }
  }

  private parseImageAttributes(attrs: string): {
    id?: string;
    size?: ImageSize;
    caption?: string;
  } {
    const result: { id?: string; size?: ImageSize; caption?: string } = {};

    const idMatch = attrs.match(/#([^\s}]+)/);
    if (idMatch) result.id = idMatch[1];

    const sizeMatch = attrs.match(/size=(\w+)/);
    if (sizeMatch && this.isValidImageSize(sizeMatch[1])) {
      result.size = sizeMatch[1] as ImageSize;
    }

    const captionMatch = attrs.match(/caption="([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (captionMatch) {
      result.caption = captionMatch[1].replace(/\\"/g, '"');
    }

    return result;
  }

  private isValidImageSize(value: string): value is ImageSize {
    return (
      value === "small" ||
      value === "medium" ||
      value === "default" ||
      value === "full"
    );
  }

  private addClasses(element: Element, ...classNames: string[]) {
    const existing = (element.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean);
    const classSet = new Set(existing);
    classNames.forEach((name) => {
      if (name) classSet.add(name);
    });
    if (classSet.size > 0) {
      element.setAttribute("class", Array.from(classSet).join(" "));
    }
  }

  private setCaptionContent(
    figcaption: HTMLElement,
    captionText: string,
    document: Document,
  ) {
    figcaption.textContent = "";
    this.buildCaptionNodes(document, captionText).forEach((node) => {
      figcaption.appendChild(node);
    });
  }

  private buildCaptionNodes(document: Document, captionText: string): Node[] {
    const nodes: Node[] = [];
    const pattern =
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    pattern.lastIndex = 0;
    while ((match = pattern.exec(captionText)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(
          document.createTextNode(captionText.slice(lastIndex, match.index)),
        );
      }

      const label = match[1];
      const href = match[2] || match[3];
      if (href) {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", href);
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.textContent = label || href;
        nodes.push(anchor);
      } else if (match[0]) {
        nodes.push(document.createTextNode(match[0]));
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < captionText.length) {
      nodes.push(document.createTextNode(captionText.slice(lastIndex)));
    }

    return nodes;
  }

  parseMarkdown(content: string): { metadata: any; body: string } {
    /**
     * Front matter 추출 및 본문 분리
     * YAML front matter 처리는 유지 (포스트 메타데이터 필요)
     */
    const metadata = {
      title: "Untitled",
      category: "general",
      tags: [],
    };
    let body = content;

    // Front matter 처리 (--- 로 감싸진 YAML)
    if (content.startsWith("---")) {
      const parts = content.split("---", 3);
      if (parts.length >= 3) {
        const frontMatter = parts[1].trim();
        body = parts[2].trim();

        // 간단한 YAML 파싱
        const lines = frontMatter.split("\n");
        for (const line of lines) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();

            // 따옴표 제거
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }

            // 배열 처리 (간단한 JSON 파싱)
            if (value.startsWith("[") && value.endsWith("]")) {
              try {
                metadata[key] = JSON.parse(value);
              } catch {
                metadata[key] = [value];
              }
            } else {
              metadata[key] = value;
            }
          }
        }
      }
    }

    // 첫 번째 h1에서 제목 추출 (front matter가 없는 경우)
    if (metadata.title === "Untitled") {
      const h1Match = body.match(/^#\s+(.+)$/m);
      if (h1Match) {
        metadata.title = h1Match[1].trim();
      }
    }

    return { metadata, body };
  }
}
