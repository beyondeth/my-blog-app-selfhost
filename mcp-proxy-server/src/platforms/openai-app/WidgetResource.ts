import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolContext } from '../../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ChatGPT App 위젯 리소스 정의.
 * - URI/MIME/리소스 메타(CSP, domain, 설명)를 한 곳에서 관리한다.
 * - ToolRegistrar는 이 파일을 통해 resources/list, resources/read만 연결한다.
 * - 이 파일은 /mcp-openai 전용이며 /mcp, /mcp-remote와 분리된다.
 */
// ChatGPT 커넥터의 리소스 캐시를 안정적으로 갱신하기 위한 버전드 URI
export const OPENAI_WIDGET_URI = 'ui://widget/codebase-dashboard-v20260224a.html';
export const OPENAI_WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

type DomainSet = {
  connectDomains: string[];
  resourceDomains: string[];
  widgetDomain: string;
};

function toOrigin(urlLike: string | undefined): string | null {
  if (!urlLike) return null;
  try {
    return new URL(urlLike).origin;
  } catch {
    return null;
  }
}

function normalizeDomains(context: ToolContext): DomainSet {
  const connect = new Set<string>();
  const resource = new Set<string>();

  for (const candidate of [
    context.config.BACKEND_PUBLIC_URL,
    context.config.BACKEND_BASE_URL,
    context.config.MCP_BASE_URL,
  ]) {
    const origin = toOrigin(candidate);
    if (origin) connect.add(origin);
  }

  for (const candidate of [context.config.FRONTEND_URL, context.config.MCP_BASE_URL]) {
    const origin = toOrigin(candidate);
    if (origin) resource.add(origin);
  }

  const widgetDomain =
    toOrigin(context.config.FRONTEND_URL) ||
    toOrigin(context.config.MCP_BASE_URL) ||
    toOrigin(context.config.BACKEND_PUBLIC_URL) ||
    'http://localhost:3001';

  return {
    connectDomains: [...connect],
    resourceDomains: [...resource],
    widgetDomain,
  };
}

function getWidgetHtml(): string {
  try {
    let htmlPath = path.resolve(__dirname, 'widget', 'dist', 'index.html');
    
    // dist 빌드 환경(런타임)인 경우 src/ 경로로 찾기
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.resolve(__dirname, '../../../src/platforms/openai-app/widget/dist/index.html');
    }

    return fs.readFileSync(htmlPath, 'utf-8');
  } catch (err) {
    console.error('[OpenAI Widget] Failed to load built widget HTML:', err);
    return `<!doctype html><html><body><h1>Widget Build Missing</h1><p>Run <code>pnpm run build</code> in the widget directory.</p></body></html>`;
  }
}

export function getWidgetResourceListEntry() {
  // resources/list에 노출되는 정적 메타
  return {
    uri: OPENAI_WIDGET_URI,
    name: 'Codebase Dashboard Widget',
    title: 'Codebase.blog Result View',
    description: 'Inline UI for auth, style guide, and publishing results.',
    mimeType: OPENAI_WIDGET_MIME_TYPE,
  };
}

export function getWidgetResourceTemplateEntry() {
  // resources/templates에 노출되는 정적 템플릿 메타
  return {
    uriTemplate: OPENAI_WIDGET_URI,
    name: 'Codebase Dashboard Widget Template',
    title: 'Codebase.blog Result View Template',
    description: 'Template metadata for the Codebase.blog inline result widget.',
    mimeType: OPENAI_WIDGET_MIME_TYPE,
  };
}

export function readWidgetResource(context: ToolContext) {
  const { connectDomains, resourceDomains, widgetDomain } = normalizeDomains(context);

  return {
    contents: [
      {
        uri: OPENAI_WIDGET_URI,
        mimeType: OPENAI_WIDGET_MIME_TYPE,
        text: getWidgetHtml(),
        _meta: {
          ui: {
            prefersBorder: true,
            domain: widgetDomain,
            csp: {
              connectDomains,
              resourceDomains,
            },
          },
          // OpenAI 호환 키(표준 ui.* 메타와 함께 병행)
          'openai/widgetDescription':
            'Displays Codebase.blog auth and publishing results in an inline card UI.',
          'openai/widgetPrefersBorder': true,
          'openai/widgetDomain': widgetDomain,
          'openai/widgetCSP': {
            connect_domains: connectDomains,
            resource_domains: resourceDomains,
            redirect_domains: resourceDomains,
          },
        },
      },
    ],
  };
}
