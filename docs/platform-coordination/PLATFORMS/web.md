# Web Platform Log

## 2026-04-18

### KB cold-start root visibility lane

#### What changed
- Normalized KB source categories derived from auto-posting so marketplace enums like `tech_guides` are mapped into KB-facing categories such as `개발/기술 가이드` before compile.
- Added a backend-side cold-start approval path for the first meaningful domain root when a blog only has `기타`, preventing newly compiled posts from remaining invisible in the public knowledge map.
- Added backend regression tests for the normalization and cold-start approval path.

#### Impact
- web: public KB tree / map / flow-board can show a new root for freshly auto-posted content instead of staying pinned to `기타` only, once the post is recompiled or the blog is rebuilt.
- ios: no direct code change.
- android: no direct code change.

#### Risk
- Existing already-compiled posts do not automatically migrate; they still need a KB rebuild after deploy.
- Topic / concept visibility remains intentionally conservative, so first-post visibility improves at the root level first, not full deep taxonomy exposure.

#### Verification
- `pnpm --dir backend exec tsc -p tsconfig.json --noEmit`
- `pnpm --dir backend test -- --runInBand src/knowledge/services/knowledge-source-builder.service.spec.ts src/knowledge/services/knowledge-candidate-graph.service.spec.ts`

### diagram/D2 auto-posting rendering lane

#### What changed
- Promoted `diagram` fenced blocks into the tracked web rendering path and kept Mermaid as the legacy fallback.
- Added `/sample` production-path preview and `/d2` playground metadata hardening (`noindex`).
- Added explicit SVG upload rejection messaging so blocked `image/svg+xml` uploads fail as policy errors, not vague server faults.

#### Impact
- web: auto-posting markdown can now render structure/flow diagrams through the D2-backed path when the markdown contains a `diagram` block.
- ios: no direct code change.
- android: no direct code change.

#### Risk
- If MCP prompts still emit Mermaid, the new D2-backed path will not be used.
- Mobile renderers still need a separate parity decision if they should visualize `diagram` blocks the same way as web.

#### Verification
- `pnpm --dir frontend type-check`
- `pnpm --dir frontend exec playwright test tests/e2e/diagram-autoposting.spec.ts --reporter=line`
- `pnpm --dir backend test -- --runInBand src/common/services/markdown-renderer.service.spec.ts src/files/files.service.spec.ts`

### legacy Mermaid containment lane

#### What changed
- Added a backend ingress guard so direct MCP/API Key auto-posting can no longer create posts containing raw ` ```mermaid ` blocks.
- Added a Mermaid-to-`diagram` backfill command for already stored legacy posts instead of expanding permanent Mermaid runtime compatibility.
- Added regression tests for the new guard and the conversion utility.

#### Impact
- web: new auto-posted posts will stop reintroducing Mermaid render failures through the direct MCP path.
- ios: no direct code change.
- android: no direct code change.

#### Risk
- Existing legacy Mermaid posts remain broken until the backfill command is executed after deploy.
- Non-flowchart Mermaid syntaxes are intentionally skipped by the backfill and still require manual rewriting if they exist.

#### Verification
- `pnpm --dir backend test -- --runInBand src/common/utils/legacy-mermaid.util.spec.ts src/mcp/controllers/mcp-proxy.controller.spec.ts`
- `pnpm --dir backend exec tsc -p tsconfig.json --noEmit`
