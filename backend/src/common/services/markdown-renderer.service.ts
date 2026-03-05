import { Injectable, Logger } from "@nestjs/common";
import { marked } from "marked";
import { JSDOM } from "jsdom";

type ImageSize = "small" | "medium" | "default" | "full";

@Injectable()
export class MarkdownRendererService {
  private readonly logger = new Logger(MarkdownRendererService.name);

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
        this.logger.debug(
          "[Markdown Renderer] Mermaid blocks detected:",
          mermaidMatches.length,
        );
        this.logger.debug(
          "[Markdown Renderer] First block preview:",
          mermaidMatches[0].substring(0, 100) + "...",
        );
      }
    }

    const { protectedText, tokens } = this.protectImageAttributeBlocks(text);
    const fixedText = this.fixKoreanEmphasis(protectedText);
    const html = marked.parse(fixedText) as string;
    const restoredHtml = this.restoreImageAttributeBlocks(html, tokens);
    const enhancedHtml = this.applyExtendedImageAttributes(restoredHtml);

    // 개발 환경에서 변환 결과 확인 (디버깅용)
    if (process.env.NODE_ENV === "development" && text.includes("```mermaid")) {
      const hasLanguageMermaid = enhancedHtml.includes("language-mermaid");
      this.logger.debug(
        "[Markdown Renderer] Output contains language-mermaid:",
        hasLanguageMermaid,
      );
      if (!hasLanguageMermaid) {
        this.logger.warn(
          "[Markdown Renderer] WARNING: Mermaid blocks not properly converted!",
        );
        this.logger.debug(
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

  private fixKoreanEmphasis(text: string): string {
    if (!text) return text;
    // 마크다운에서 **텍스트**(괄호 포함) 바로 뒤에 한글 조사/단어가 오면
    // 볼드 처리가 깨지는 문제(CommonMark 단어 경계 스펙)를 해결하기 위해
    // 닫는 ** 또는 __ 뒤에 폭 없는 공백(&#8203;)을 삽입합니다.
    // 단, 코드 블록(```...```)이나 인라인 코드(`...`) 내부는 건너뜁니다.
    return text.replace(
      /(```[\s\S]*?```|`[^`\n]+`)|(\*\*|__)([^\n]*?)\2(?=[가-힣a-zA-Z0-9])/g,
      (match, code, asterisks, content) => {
        if (code) return match; // 코드 블록은 원본 그대로 반환
        return `${asterisks}${content}${asterisks}&#8203;`;
      },
    );
  }

  private applyExtendedImageAttributes(html: string): string {
    if (!html) return html;
    if (
      !html.includes("{#") &&
      !html.includes("size=") &&
      !html.includes("caption=")
    ) {
      return this.applyYouTubeEmbeds(html);
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

      this.applyYouTubeEmbedsToDocument(document, Node);

      return document.body.innerHTML;
    } catch (error) {
      this.logger.warn(
        "[Markdown Renderer] Failed to apply image attributes:",
        error,
      );
      return this.applyYouTubeEmbeds(html);
    }
  }

  private applyYouTubeEmbeds(html: string): string {
    if (!html) return html;
    if (!this.containsYouTubeUrl(html)) return html;

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const { Node } = dom.window;

      this.applyYouTubeEmbedsToDocument(document, Node);

      return document.body.innerHTML;
    } catch (error) {
      this.logger.warn(
        "[Markdown Renderer] Failed to apply YouTube embeds:",
        error,
      );
      return html;
    }
  }

  private applyYouTubeEmbedsToDocument(
    document: Document,
    NodeRef: { TEXT_NODE: number; ELEMENT_NODE: number; COMMENT_NODE: number },
  ) {
    const preferredVideoId = this.extractYouTubeThumbnailMarker(
      document,
      NodeRef,
    );
    const candidates = Array.from(document.querySelectorAll("p"));

    candidates.forEach((element) => {
      const parentTag = element.parentElement?.tagName || "";
      if (["LI", "BLOCKQUOTE", "PRE", "CODE"].includes(parentTag)) {
        return;
      }

      const url = this.extractStandaloneUrl(element, NodeRef);
      if (!url) return;

      const videoId = this.extractYouTubeVideoId(url);
      if (!videoId) return;

      const embed = this.buildYouTubeEmbedElement(
        document,
        videoId,
        url,
        preferredVideoId === videoId,
      );
      element.replaceWith(embed);
    });

    if (preferredVideoId) {
      const embeds = Array.from(
        document.querySelectorAll("div[data-youtube-video]"),
      );
      for (const embed of embeds) {
        const iframe = embed.querySelector("iframe");
        const src = iframe?.getAttribute("src") || "";
        if (src.includes(preferredVideoId)) {
          embed.setAttribute("data-thumbnail", "true");
          break;
        }
      }
    }
  }

  private extractStandaloneUrl(
    element: Element,
    NodeRef: { TEXT_NODE: number; ELEMENT_NODE: number; COMMENT_NODE: number },
  ): string | null {
    const nonWhitespaceNodes = Array.from(element.childNodes).filter((node) => {
      if (node.nodeType === NodeRef.TEXT_NODE) {
        return (node.textContent || "").trim().length > 0;
      }
      return true;
    });

    if (nonWhitespaceNodes.length === 1) {
      const node = nonWhitespaceNodes[0];
      if (node.nodeType === NodeRef.TEXT_NODE) {
        const text = (node.textContent || "").trim();
        return text || null;
      }

      if (
        node.nodeType === NodeRef.ELEMENT_NODE &&
        (node as Element).tagName === "A"
      ) {
        const anchor = node as HTMLAnchorElement;
        const href = anchor.getAttribute("href")?.trim();
        return href || (anchor.textContent || "").trim() || null;
      }
    }

    return null;
  }

  private buildYouTubeEmbedElement(
    document: Document,
    videoId: string,
    originalUrl: string,
    isPreferred: boolean,
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-youtube-video", "true");
    wrapper.setAttribute("data-original-url", originalUrl);
    if (isPreferred) {
      wrapper.setAttribute("data-thumbnail", "true");
    }
    wrapper.setAttribute(
      "style",
      "position: relative; width: 685px; height: 540px; max-width: 100%; margin: 0 auto;",
    );

    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", `https://www.youtube.com/embed/${videoId}`);
    iframe.setAttribute("width", "100%");
    iframe.setAttribute("height", "100%");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    iframe.setAttribute(
      "style",
      "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;",
    );

    wrapper.appendChild(iframe);
    return wrapper;
  }

  private extractYouTubeThumbnailMarker(
    document: Document,
    NodeRef: { COMMENT_NODE: number },
  ): string | null {
    const markers: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      (document.defaultView as any)?.NodeFilter?.SHOW_COMMENT ?? 128,
    );

    let node = walker.nextNode() as Comment | null;
    while (node) {
      const content = (node.nodeValue || "").trim();
      const match = content.match(/YT_THUMBNAIL:([a-zA-Z0-9_-]{11})/);
      if (match?.[1]) {
        markers.push(match[1]);
        node.parentNode?.removeChild(node);
      }
      node = walker.nextNode() as Comment | null;
    }

    return markers[0] ?? null;
  }

  private containsYouTubeUrl(html: string): boolean {
    return /youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\//i.test(html);
  }

  private extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    try {
      const parsed = new URL(normalizedUrl);
      const host = parsed.hostname.toLowerCase();

      const isYouTubeHost =
        host === "youtube.com" ||
        host === "www.youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtu.be" ||
        host === "www.youtu.be" ||
        host === "youtube-nocookie.com" ||
        host === "www.youtube-nocookie.com";

      if (!isYouTubeHost) return null;

      if (host.includes("youtu.be")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[1]);
      }

      if (parsed.pathname.startsWith("/watch")) {
        return this.normalizeYouTubeId(parsed.searchParams.get("v"));
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[2]);
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[2]);
      }

      if (parsed.pathname.startsWith("/v/")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[2]);
      }

      return null;
    } catch {
      const fallbackMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
      );
      return fallbackMatch?.[1] || null;
    }
  }

  private normalizeYouTubeId(value: string | null | undefined): string | null {
    if (!value) return null;
    const match = value.match(/[a-zA-Z0-9_-]{11}/);
    return match ? match[0] : null;
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
