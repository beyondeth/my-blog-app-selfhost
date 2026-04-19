# Web Platform Log

## 2026-04-19

### english-first public launch + Klaro consent lane

#### What changed
- Switched the public locale model to English-first canonical routing: unprefixed URLs are now the only public canonical paths, while `/en/*` and `/ko/*` permanently redirect back to the unprefixed route.
- Changed `/` so signed-out visitors are served the public `/product` experience, while authenticated users still land in the app shell (`/desktop` or `/mobile`) based on device class.
- Replaced the custom cookie banner with a Klaro-based consent manager, wired it to keep analytics opt-in disabled by default, and added a logged-in-only backend audit endpoint for consent decision storage.
- Forced the public docs/legal/auth experience onto English copy, removed the locale switcher from the public header, and hid the development cache-clear button unless `NEXT_PUBLIC_ENABLE_DEBUG_CACHE_CLEAR=true` is explicitly set.

#### Impact
- web: public traffic now lands on an English marketing/docs/legal/auth surface without Korean route variants or Korean UI leakage in the verified launch pages.
- ios: no direct runtime change, but shared consent audit storage now exists on the backend if native clients later adopt the same consent event contract.
- android: no direct runtime change, but shared consent audit storage now exists on the backend if native clients later adopt the same consent event contract.

#### Risk
- The app shell remains reachable at `/desktop` and `/mobile`, so any anonymous links that point there directly can still surface non-launch community/feed data until those routes are separately gated or redesigned.
- Klaro currently blocks analytics by default and only syncs consent audits for authenticated users; if anonymous consent history becomes a requirement later, that needs a separate storage design.
- The temporary TypeScript handling for Klaro depends on a local `ts-expect-error` because the upstream package ships without typings.

#### Verification
- `pnpm --dir frontend type-check`
- `pnpm --dir frontend lint`
- `pnpm --dir backend exec tsc -p tsconfig.json --noEmit`
- Playwright smoke via `pnpm --dir frontend exec node - <<'NODE' ... NODE` against `/`, `/product`, `/docs`, `/legal/privacy`, `/login`, `/register`, `/en/product`, `/ko/docs`

## 2026-04-18

### managed image relation self-heal lane

#### What changed
- Added a shared/backend reconciliation pass so post save/update reattaches internal managed upload URLs into `post_files` using both HTML and markdown sources.
- Added an orphan-cleanup safeguard that rechecks live post references before scheduling image deletion, including `content`, `content_markdown`, and `thumbnail_image_id`.
- Added an admin dry-run/repair entrypoint for already published posts whose managed images exist in content but lost their relation rows.

#### Impact
- web: post detail pages and editor-rendered content are less likely to lose inline images due to stale `post_files` state or delayed orphan cleanup.
- ios: no direct code change, but shared image retention logic is safer for any clients that depend on the same backend file lifecycle.
- android: no direct code change, but shared image retention logic is safer for any clients that depend on the same backend file lifecycle.

#### Risk
- Already deleted objects cannot be restored by relation repair alone; the new flow only prevents future false-orphan cleanup and repairs posts whose file rows still exist.
- The admin repair flow should be dry-run reviewed first on production because it can relink a large number of historic posts if many legacy saves skipped `post_files`.

#### Verification
- `pnpm --dir backend exec tsc -p tsconfig.json --noEmit`
- `pnpm --dir backend exec jest --runInBand src/posts/utils/post.utils.spec.ts`
- `pnpm --dir backend exec jest --runInBand src/files/tests/services/file-lifecycle.service.spec.ts -t "skip scheduling when a post still references the file key|should not process files with existing context"`

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

### English-first public surface cleanup lane

#### What changed
- Translated the remaining public app-connection docs (`ChatGPT`, `Perplexity`, `Claude`) and aligned the copy with native English product documentation.
- Replaced leftover Korean UI strings in the shared web chrome: search, sidebars, dropdown menus, home feed labels, profile cards, community cards, tags, analytics placeholder, and 404 page.
- Kept canonical public URLs unchanged while verifying that the main public routes render English-only copy for SEO and first-visit experience.

#### Impact
- web: public entry pages and shared navigation now present a consistent English-first experience for Product Hunt and other overseas traffic.
- ios: no direct code change.
- android: no direct code change.

#### Risk
- Logged-in content surfaces can still show Korean user-generated titles or descriptions; this lane intentionally changed product chrome only.
- A few auth flows still retain Korean branches in source for fallback handling, but runtime stays English because the locale provider defaults to `en`.

#### Verification
- `pnpm --dir frontend type-check`
- `pnpm --dir frontend lint`
- Browser smoke check on `/`, `/product`, `/docs`, `/docs/apps/*`, `/support`, `/login`, `/register`, `/legal/privacy`, `/legal/terms`, and a 404 path confirmed `hasKorean: false` in rendered body text.

### MCP/OpenAI English-first auto-posting lane

#### What changed
- Translated the `mcp-proxy-server` user-facing and model-facing copy used by the OpenAI/ChatGPT posting flow, including auth summaries, post-publish status text, writing-style guide responses, and environment validation logs.
- Converted the writing-style markdown assets to English so prompt material sent into the LLM is now aligned with the English-first public product.
- Kept the ChatGPT widget bilingual, but changed locale selection so only Korean browsers see the Korean widget dictionary; every other browser falls back to English.
- Updated the widget placeholder formatter for ES2020 compatibility and refreshed the static tool-parity script to match the current tool catalog plus the `sell` preset.

#### Impact
- web: OpenAI app users now see English-first MCP summaries, style prompts, and publish confirmations that match the rest of the launch surface.
- ios: no direct code change.
- android: no direct code change.

#### Risk
- The widget still contains an intentional Korean locale bundle, so repository-wide Korean string searches must exclude that file if the goal is to find accidental runtime leakage.
- `verify:openai-contract` is environment-sensitive and will continue to fail with `401` until a valid local OAuth-authenticated `/mcp-openai` session exists.

#### Verification
- `pnpm --dir mcp-proxy-server build`
- `pnpm --dir mcp-proxy-server widget:build`
- `pnpm --dir mcp-proxy-server verify:tool-parity`
- `pnpm --dir mcp-proxy-server verify:openai-contract` currently returns `HTTP 401` without local auth context
