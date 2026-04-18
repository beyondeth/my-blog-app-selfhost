# Platform Coordination Changelog

Track operational rule changes for worktree/branch coordination.

## 2026-04-18

### Additional update (production monitoring noise reduced by separating datasource outages from component pages)

#### What changed
- Increased the production `victoriametrics` container headroom in `docker-compose.prod.oracle.yml` from `100m/50m` to `256m/128m` and lowered `--memory.allowedPercent` from `80` to `60`.
- Changed the Grafana core availability rules for backend, mcp-proxy, and redis so `execErrState` is now `OK` instead of `Error`.
- Updated `monitoring/README.md` to document that datasource failures are handled as VictoriaMetrics/Grafana operations issues rather than backend / mcp-proxy / redis pager events.

#### Why
- Production investigation showed the Telegram alerts were not real backend, MCP Proxy, or Redis outages. They were `DatasourceError` fan-out alerts emitted while `codebase-prod-victoriametrics` was repeatedly restarting under a `100m` memory cap.
- That behavior created misleading incident signals because a single datasource interruption looked like three different component failures.

#### How
- Kept the public monitoring contract unchanged and limited the change to production compose limits, Grafana alert evaluation policy, and the monitoring runbook.
- Preserved the existing core availability rules for genuine `up == 0` conditions while preventing datasource execution failures from paging as component-down alerts.

### Additional update (diagram block promoted to tracked rendering path)

#### What changed
- Promoted the custom `diagram` fenced block path from local experiment status into the tracked web rendering path.
- Added a local verification surface at `/sample` that renders the same markdown through `convertMarkdownToHtml -> HtmlContentRenderer`, so the actual post-detail renderer path can be checked without publishing a post.
- Kept existing `mermaid` support intact as a legacy-compatible fallback while moving new flow/structure authoring toward `diagram -> internal D2 conversion`.
- Changed `files/upload-url` to reject `image/svg+xml` with an explicit policy message instead of surfacing it like an internal server error.

#### Why
- We needed a cleaner default for structure diagrams in auto-posted documents than raw Mermaid, but without breaking previously published Mermaid posts.
- The SVG upload rejection is intentional for security, so the API needed to say that clearly rather than looking unstable.
- Local verification needed a route that exercises the real content renderer path, not just a markdown-only preview.

#### How
- Added D2-backed diagram generation metadata and test selectors to the web renderer path, plus noindex metadata for `/sample` and `/d2`.
- Added backend specs for markdown `diagram` fences and SVG rejection messaging, and a Playwright check for both `/sample` and `/d2`.
- Recorded the mobile follow-up risk explicitly: apps still need their own `diagram` parity if they ever render raw markdown/code blocks directly.

## 2026-04-17

### Additional update (web app connection mode + replaceable screenshot docs slots)

#### What changed
- Added a new `웹/앱` mode to `frontend/src/app/settings/api-keys/page.tsx` without disturbing the existing `SKILLS 설치`, `MCP 직접 설정`, and `LLM Agents 설치` flows.
- Added new public docs routes for web/app surfaces:
  - `/docs/apps`
  - `/docs/apps/chatgpt`
  - `/docs/apps/perplexity`
  - `/docs/apps/claude`
- Added screenshot-slot rendering so each guide now auto-loads static screenshots from `frontend/public/docs/apps/<surface>/...` when files exist, and otherwise shows a replacement placeholder with the exact file path to drop in later.
- Updated docs navigation and Getting Started copy so web/app environment guides are discoverable from the public docs shell.

#### Why
- We needed a setup path grouped by usage environment, not by developer persona, so web/app surfaces like ChatGPT and Claude can be documented alongside existing CLI/IDE flows without rewriting the current MCP onboarding.
- Screenshot maintenance also needed to be file-path-driven so product walkthrough images can be updated later without editing page code again.

#### How
- Kept the implementation web-only inside the settings/docs surface and static docs assets.
- Reused a shared app-doc data structure plus server-rendered screenshot slots to keep the three platform pages consistent.
- Marked the Perplexity guide as `manual verification required` because the official docs currently confirm Perplexity's MCP server for other clients, but do not yet confirm a user-facing Perplexity web/mobile flow for connecting an external remote MCP server.

### Additional update (web docs aligned to live MCP publishing behavior)

#### What changed
- Rewrote the `/docs` entry pages so they now describe the hosted MCP model that is actually shipped today, instead of the older local proxy / OAuth tunnel narrative.
- Updated Getting Started, API Keys & MCP, Publishing Flow, FAQ, and Writing Styles to match the live `/settings/api-keys` setup surface and current backend contracts.
- Added the missing public `sell` writing-style document and synced common rules so marketplace product posting is documented alongside the 8 standard preset styles.

#### Why
- The existing docs no longer matched the product’s real setup path, which made them risky as a public source of truth for users configuring MCP clients.
- Writing-style docs were also incomplete because public docs exposed 8 presets while backend behavior already included a separate `sell` mode and shared rules.

#### How
- Treated `/settings/api-keys` plus backend MCP controllers/services as the implementation source of truth, then reconciled the public docs copy against those contracts.
- Kept the work web-only in the docs surface and docs assets, with no backend, shared contract, iOS, or Android runtime changes.

### Additional update (web public product footer copy and legal labels localized to English)

#### What changed
- Updated the `/product` public footer brand lockup to show a copyright icon before `Codebase`.
- Replaced the footer body copy with an English product statement describing Codebase as a platform that refines and publishes AI-platform conversations into structured knowledge.
- Renamed the `LEGAL` footer links to `Privacy Policy`, `Terms of Service`, and `Community Guidelines`.

#### Why
- The previous footer paragraph described the docs/support surface architecture instead of the product value for end users.
- The legal area on the public product page needed English labels to match the rest of the updated footer copy.

#### How
- Scoped the change to the web-only public-site footer component and public navigation constants.
- No backend, shared contract, iOS, or Android changes were introduced.

### Additional update (web KB map rail gained the same category/knowledge tabs as blog home)

#### What changed
- Added the same `카테고리 / 지식 지도` tab strip used on the blog home sidebar to the KB map right rail and mobile drawer.
- Kept `지식 지도` as the default selected tab on `/[blogSlug]/kb/map`, while adding a lazy-loaded `카테고리` panel that reuses the existing category sidebar component.
- Wired KB map category clicks to navigate back to the public blog home with the corresponding `category` filter applied.

#### Why
- The KB map rail was missing the same top-level sidebar mode switch that already exists on the blog home, which made the two surfaces feel inconsistent.
- Keeping the same tabs and interaction language reduces cognitive load while preserving the D2 graph as the main focus of the KB map page.

#### How
- Scoped the change to web-only sidebar components and KB map client composition with no backend, shared contract, iOS, or Android impact.
- Preserved KB map initial performance by loading category data only after the category tab is opened.

### Additional update (web sidebar active-folder indicator aligned across categories and KB structure)

#### What changed
- Added a shared active-node icon treatment so selected sidebar folders render with a small status dot on the icon instead of relying on row color alone.
- Wired the public blog category sidebar to the current `category` URL param, including auto-expanding the active parent branch and highlighting the selected child row.
- Applied the same active icon indicator to the public KB map structure sidebar so the currently focused topic is easier to scan in the tree rail.

#### Why
- The previous sidebar state relied too much on subtle row styling, which made it harder to identify the currently selected folder at a glance.
- Aligning the category and KB structure behaviors reduces visual ambiguity and keeps the interaction language consistent across the public surface.

#### How
- Scoped the change to web-only sidebar components with no backend, shared contract, iOS, or Android impact.
- Revalidated with frontend type-check and targeted lint on the touched sidebar files.

## 2026-04-16

### Additional update (web KB map shell opened up and tree rail redesigned)

#### What changed
- Removed the public KB page breadcrumb, the local `블로그 홈` CTA, and the outer map frame border so the KB map now opens more directly into the canvas.
- Kept the center D2 canvas structure/design intact after review, and limited the visual redesign to the surrounding shell and the right-side navigation rail.
- Rebuilt the right rail as a single explorer-style tree card modeled on the provided reference image: folder/file hierarchy, Lucide icons, full-tree scroll, and no metadata header or preview buttons.
- Updated the KB Playwright spec to assert the removed chrome and the new tree-panel presence.

#### Why
- The previous page felt boxed-in because the breadcrumb, header bar, outer frame, and nested cards all competed with the actual knowledge structure.
- The rail was also behaving like a dashboard widget rather than a navigation tree, which made the structure harder to scan at a glance.
- The center D2 graph is already the main knowledge visualization, so its structure and styling were restored to avoid unnecessary UX drift.

#### How
- Scoped the change to the web-only KB map page, D2 view, tree sidebar, and E2E expectations with no backend, shared contract, iOS, or Android impact.
- Revalidated with frontend type-check, targeted ESLint on the touched KB files, and Playwright `tests/e2e/kb-map.spec.ts`.

### Additional update (web KB map right panel collapsed to structure-only)

#### What changed
- Removed the public KB map right-panel `상세` mode and kept the rail structure-only on both desktop and mobile.
- Changed KB map navigation so node clicks now only move map focus to `/<blogSlug>/kb/map?focus=<slug>` and no longer carry `detail`, `panel`, or `view` query state.
- Turned the legacy `/kb/[nodeSlug]` route into a compatibility redirect that forwards into the focus-only map URL.
- Deleted the unused frontend node-detail panel component and the dead client-side `getKnowledgeNodeDetail(...)` API wrapper.

#### Why
- The split between `구조` and `상세` made the right rail hard to read: clicking a structure item unexpectedly changed UI mode instead of drilling further into structure.
- Keeping only one mental model, "center map + right rail both show structure", makes the KB easier to scan and removes the stale detail state that had already caused overlay and hook-state regressions.

#### How
- Scoped the change to web KB map routing, focus state, sidebar rendering, and client-side API cleanup with no backend, shared contract, iOS, or Android changes.
- Revalidated with frontend type-check, targeted ESLint on the touched KB files, and Playwright `tests/e2e/kb-map.spec.ts` for focus-only routing and legacy-query normalization.

### Additional update (web KB map detail overlay desktop regression fix)

#### What changed
- Fixed the KB map detail interaction so desktop detail clicks no longer activate a hidden Radix dialog overlay.
- Kept the detail drawer modal behavior only for mobile viewports, while desktop continues to use the inline right-side detail panel.
- Extended the KB Playwright spec to assert that desktop detail open keeps the page on the map without any modal portal overlay.

#### Why
- The previous implementation opened `Dialog` whenever `detail` existed in the URL and only hid the content with `lg:hidden`, which left the dark overlay/focus trap active on desktop.
- That created a confusing “screen got dark” regression even though desktop detail was supposed to stay inline.

#### How
- Scoped the fix to the web-only KB map container by gating the dialog `open` state with a mobile media query.
- Revalidated with frontend type-check, targeted ESLint, and Playwright `tests/e2e/kb-map.spec.ts`.

### Additional update (web public KB IA unified to a single map surface)

#### What changed
- Removed the standalone public KB tree/detail surface from the active web IA and made the map the only primary public entrypoint.
- Changed internal KB links so node navigation now opens `/<blogSlug>/kb/map?focus=<slug>&detail=<slug>` directly instead of sending users to a separate `/kb/[nodeSlug]` page.
- Changed the legacy `/kb` and `/kb/[nodeSlug]` routes into compatibility redirects that forward users into the map state.
- Added an inline map-side node detail panel/drawer so node detail, related topics, and linked posts are now read inside the same map session.
- Simplified the public sidebar/home labels from `WIKI TREE` toward `지식 지도` so the public surface no longer suggests a second top-level KB mode.

#### Why
- The previous public KB flow split users across three surfaces: tree index, node detail page, and map. That diluted the main mental model and made the public KB feel heavier than necessary.
- Keeping the map as the single public surface makes the KB easier to scan and removes the extra navigation cost of leaving the map just to inspect one node.

#### How
- Kept the backend public read endpoints unchanged (`knowledge-tree`, `knowledge-flow-board`, `knowledge/nodes/:nodeSlug`) so web-only IA changes do not break iOS, Android, or shared contracts.
- Revalidated the change with frontend type-check, targeted ESLint on the KB files, and Playwright `tests/e2e/kb-map.spec.ts` covering redirect + detail-panel flows.

### Additional update (web KB map board view removed, D2 became the single mode)

#### What changed
- Removed the KB map board-view toggle and the entire board-only canvas implementation.
- Changed the KB map page so D2 is always the single rendered mode, and `buildMapHref(...)` no longer emits a `view` query.
- Kept legacy `?view=flow` or `?view=d2` links readable, but the client now normalizes them back to the canonical D2-only map URL.

#### Why
- The board view was no longer intended to ship and keeping a second UI mode was adding maintenance and test surface for a path we do not want users to use.
- D2 is now the primary knowledge-map representation, so leaving the old toggle and query state in place would only preserve dead UX and dead code paths.

#### How
- Scoped the change to web-only KB map routing/components/tests with no backend, shared contract, iOS, or Android impact.
- Replaced the mixed-mode Playwright coverage with D2-only navigation, legacy-query normalization, evidence-toggle, and single-branch layout checks.

### Additional update (web KB representative-post inline expansion UX)

#### What changed
- Replaced the KB flow-board/D2 `대표 포스트 +N` badge with an inline toggle that reads `N개 더 보기` and `접기`.
- Kept the existing backend evidence payload contract intact, so panels still receive up to 3 representative posts and reveal the extra item inside the same card instead of hiding it behind an ambiguous count chip.
- Updated the flow-board canvas layout logic so evidence expansion recalculates card height only when a panel is actually expanded, avoiding the collapsed-state blank gap.

#### Why
- The previous `+1` badge read like “대표 포스트가 1개” rather than “숨겨진 포스트가 1개 더 있음”, which made the UI meaning ambiguous.
- Showing the extra representative post in-place is clearer than forcing users to infer hidden content from a compact badge with no direct action.

#### How
- Scoped the change to the web-only KB board components with no backend, shared contract, iOS, or Android changes.
- Revalidated the interaction with frontend type-check, targeted ESLint on the updated KB board files, and Playwright `tests/e2e/kb-map.spec.ts`.

### Additional update (web docs FAQ JSX command string parse fix)

#### What changed
- Fixed the `/docs/faq` page so the shell command example containing `awk '{print $2}'` is rendered as a literal string instead of being parsed as JSX.
- Reformatted the adjacent line break to keep the command block valid JSX.

#### Why
- The raw `{print $2}` sequence inside a `<code>` node was being interpreted as a JSX expression, which broke parsing for `frontend/src/app/docs/faq/page.tsx` and surfaced as editor/type errors.

#### How
- Scoped the change to the web-only docs page with no backend, shared contract, iOS, or Android impact.
- Rechecked the file with targeted TypeScript parse and semantic diagnostics after the fix.

## 2026-04-13

### Additional update (web public surface editorial redesign pass)

#### What changed
- Reworked the web-only public product surface to reduce the generic template look across `/product`, `/pricing`, `/support`, `/updates`, and `/docs/get-started`.
- Strengthened section hierarchy with darker anchor surfaces, denser hero blocks, and more varied content rhythms instead of repeating white rounded cards.
- Expanded the docs shell and getting-started page so documentation pages read like a guided product surface rather than a sparse placeholder.

#### Why
- The first implementation matched the route structure but still looked AI-generated: too much blank space, weak hierarchy, and identical card treatments across unrelated pages.
- Public pages now function as the external product, docs, pricing, changelog, and support entry, so the visual bar needs to be materially higher than a placeholder marketing pass.

#### How
- Kept the work web-only inside `frontend/src/app/**` and `frontend/src/components/public-site/**` with no backend or shared contract changes.
- Revalidated the redesign through targeted frontend lint, full frontend type-check, and fresh Playwright screenshots for `/product`, `/pricing`, `/docs/get-started`, `/updates`, and `/support`.

### Additional update (web support center feedback relocation and legal policy redesign)

#### What changed
- Removed the `고객 피드백` action from the shared header in both desktop and mobile layouts.
- Rebuilt `/support` so the feedback entry lives in a dedicated top-of-page action panel instead of the global header.
- Reworked the legal documents section from a generic 3-card grid into a calmer policy list with document summaries and direct actions.

#### Why
- The old legal cards read like a stock template and felt visually disconnected from the rest of the support surface.
- Moving feedback into `/support` creates a clearer support-specific action flow and avoids carrying a global header CTA that only belongs in one context.

#### How
- Kept the existing `FeedbackModal` store/modal flow intact and only changed the entry point.
- Limited the change to web-only frontend files with no shared API or contract updates.
- Verified the page through targeted lint, full frontend type-check, and a live `curl -I http://localhost:3001/support` response check.

## 2026-04-11

### Additional update (Markdown `diagram` block landed as first-class web content primitive)

#### What changed
- Added first-class `diagram` fenced block support to the shared markdown/content rendering pipeline.
- `diagram` blocks are now preserved through backend sanitization/highlighting and parsed separately from generic code blocks on the frontend.
- New diagram blocks render through a D2-backed custom renderer, while legacy `mermaid` blocks remain supported.

#### Why
- Mermaid compatibility alone is not enough for auto-posted structure/flow articles where we want a cleaner visual baseline without forcing authors to hand-write verbose scene JSON.
- We need a compact Markdown-native authoring surface that can later be produced naturally by MCP auto-posting prompts.

#### How
- Kept `content_markdown` and existing publish contracts unchanged.
- Introduced a lightweight `diagram` block parser plus D2 bridge on the frontend.
- Extended shared backend sanitization/highlighting so `language-diagram` survives the markdown -> html -> render pipeline intact.

## 2026-04-10

### Additional update (open-world KB candidate/artifact architecture)

#### What changed
- Added a new shared backend KB architecture layer on top of the existing approved public graph:
  - `knowledge_source_artifacts`
  - `knowledge_candidate_nodes`
  - `knowledge_candidate_edges`
  - `knowledge_aliases`
- Added writer-scoped KB endpoints for:
  - post artifact read
  - blog candidate inbox read
  - candidate approve/reject
  - post-level `knowledge-draft` sidecar submission
- Changed KB taxonomy handling so repo taxonomy config is now a bootstrap alias/root seed, not a hard gate that forces every unknown topic into a fixed root set.

#### Why
- The previous KB root model was too dependent on a shallow repo-managed taxonomy and could not represent open-world topics cleanly.
- We need a pipeline where saved posts remain the source truth, LLM/MCP drafts stay advisory, and public WIKI TREE / map continue to read only from approved knowledge nodes.

#### How
- Kept `create_post` and existing publish contracts unchanged.
- Added an internal flow of `source artifact -> candidate graph -> approved public graph`.
- Routed existing KB graph upsert through the candidate layer so provisional topics can exist without immediately polluting the public taxonomy.

### Additional update (web-only `/sample` route for MCP auto-posting document preview)

#### What changed
- Added a web-only sample route at `/sample` to evaluate a document-style viewer for MCP auto-posting output.
- Implemented a Markdown-native sample renderer with:
  - heading-based outline
  - table wrappers
  - checklist rendering
  - Mermaid workflow blocks
  - code cards with copy affordance
- Kept the experiment isolated from the existing production post detail renderer.

#### Why
- We need a low-risk way to judge whether Antigravity-style document UX should be adopted for auto-posted markdown content.
- The evaluation target is readability and presentation quality, not a production rendering swap yet.

#### How
- Reused existing frontend code/Mermaid rendering primitives.
- Added sample-only shell/viewer/components under `frontend/src/components/sample/**`.
- Avoided backend/API contract changes and left current HTML post rendering untouched.

## 2026-04-08

### Additional update (public web KB exposure wired on top of async shadow graph)

#### What changed
- Added public read-only knowledge projection routes on shared backend paths:
  - `GET /blogs/slug/:slug/knowledge-tree`
  - `GET /blogs/slug/:slug/knowledge/nodes/:nodeSlug`
  - `GET /posts/:id/knowledge-context`
  - `GET /feed/knowledge/trending`
- Added a dedicated backend projection service for public KB views so the existing owner-scoped MCP read service remains separate.
- Exposed the existing shadow KB in web UI:
  - blog sidebar now has `카테고리 / 위키` tabs
  - home sidebar now shows `Trending Knowledge`
  - post detail now shows the current post's KB path and node badges above related posts
  - new public node route: `/[blogSlug]/kb/[nodeSlug]`

#### Why
- The async shadow KB was already being built after publish, but nothing in the public product surface rendered it.
- We needed a read-only public projection that does not change autopost latency, publish contracts, or MCP authoring flow.

#### How
- Kept the knowledge graph derived and post-publish only.
- Projected only active nodes backed by visible posts, and allowed private-blog/private-post reads only for owner/admin contexts.
- Left the existing category UI intact and layered wiki discovery next to it instead of replacing it.

### Additional update (async shadow knowledge graph landed behind existing publish fast-path)

#### What changed
- Added a shared-path backend/MCP slice for an async shadow knowledge graph:
  - new `backend/src/knowledge/**` module, queue, entities, and compile services
  - MCP read/manage endpoints for knowledge manifest, node search/detail, and follow-up suggestions
  - `mcp-proxy-server` tool catalog/handler entries for those new knowledge operations
- Wired the knowledge compile trigger only after existing post-processing completes.

#### Why
- We need a user-scoped knowledge accumulation lane without slowing or destabilizing the current publish fast-path.
- The new slice is intentionally additive so `posts`/`post_metadata` remain the public source of truth while the knowledge graph stays derived and recoverable.

#### How
- Kept `create_post` and existing publish contracts unchanged.
- Routed graph compilation through background queues after post processing rather than injecting graph reads into the live publish request.
- Limited first-phase exposure to MCP read/manage tools instead of immediately changing public web/iOS/Android contracts.

## 2026-03-19

### Additional update (blog branding uploads moved to persistent blog context)

#### What changed
- Switched blog branding uploads in `frontend/src/components/settings/BlogBrandingSettings.tsx` from generic `files/upload-*` flow to contextual `files/v2/blogs/:blogId/{logo|favicon|banner}` endpoints.
- Added `POST /api/v1/files/v2/blogs/:blogId/favicon` in `backend/src/files/controllers/files-v2.controller.ts` so `iconUrl` can use the same persistent blog-owned storage path as logo and cover images.
- Confirmed the existing 404 issue was caused by blog branding fields storing CDN URLs for files created under `system/content` temporary context instead of `blog` context.

#### Why
- Generic uploads are created under temporary/system content context and can later be marked orphaned by the file lifecycle cleanup job.
- Blog branding images are long-lived assets, so they must not share the temporary upload lifecycle used for draft/post content.

#### How
- Kept the existing `blogs.logoUrl/iconUrl/coverImageUrl` contract intact.
- Changed only the upload source of truth so future uploads return a persistent contextual CDN URL before the branding record is updated.
- Verified the broken example blog (`alias=park1818`) had branding URLs under `uploads/image/...`, while the surviving logo file was still attached to a `system/content` context and already had an `expiresAt` deletion schedule.

### Additional update (temporary `/landing2` route removed)

#### What changed
- Removed the temporary app route files for `/landing2`.
- Updated `/landing` CTA links that pointed to `/landing2` so they now go directly to the creator pilot inquiry mail link.
- Removed `landing2` from the reserved top-level segment list in `frontend/src/proxy.ts`.

#### Why
- The route existed only for temporary validation and was no longer intended to ship.
- Leaving it in place caused Next route type generation to keep `/landing2` in the app route set and contributed to validator drift during frontend type-check.

### Additional update (baseline-browser-mapping build warning filtered at script level)

#### What changed
- Removed the direct `baseline-browser-mapping` devDependency from `frontend/package.json`.
- Added a `pnpm.overrides` pin to keep the transitive `baseline-browser-mapping` version on `2.10.8`.
- Switched the frontend build script to `frontend/scripts/run-next-build.js`, which still runs `next build --webpack` but filters only the repeated `baseline-browser-mapping` warning line from build output.

#### Why
- The warning was build-time noise rather than an application/runtime failure.
- Updating the transitive dependency alone did not stop Next 16.0.10 from printing the stale-data warning in this workspace, so the safest practical fix was to preserve the build command and suppress only that one known line.

#### How
- Kept `next build --webpack` as the actual production build command.
- Preserved build exit codes by forwarding the child process result from the wrapper script.
- Re-verified with `pnpm --dir frontend build` and `pnpm --dir frontend type-check`.

## 2026-03-12

### Additional update (OpenAI autopost instruction narrowing + compact style brief)

#### What changed
- Removed `/mcp-openai` instruction text that proactively suggested `list_my_published_posts`, `search_my_published_posts`, and `read_my_published_post` during auto-posting.
- Replaced it with an explicit rule: read tools stay available, but are only for cases where the user explicitly asks to inspect previous posts.
- Changed OpenAI style confirmation to return a compact execution brief instead of the full long-form style guide.
- Removed duplicate post-style payload injection from the widget follow-up path.
- Moved compact style brief generation into the shared writing-style service so the OpenAI adapter no longer keeps a parallel style-rule map.
- Refactored OpenAI style state persistence so confirmed-style writes and nonce mutation are more centralized in the store.

#### Why
- Auto-posting was detouring into read tools to infer category or writing direction, which added avoidable network/tool latency.
- After style confirmation, the OpenAI route was still passing a large style guide and then sending similar text again from the widget, which increased drafting delay.

#### How
- Updated:
  - `mcp-proxy-server/src/platforms/openai-app/ToolRegistrar.ts`
  - `mcp-proxy-server/src/tools/catalog.ts`
  - `mcp-proxy-server/src/platforms/openai-app/widget/src/components/StyleSelector.tsx`
  - `mcp-proxy-server/src/services/WritingStyleService.ts`
  - `mcp-proxy-server/src/core/handlers/GetStyleGuideHandler.ts`
  - `mcp-proxy-server/src/platforms/openai-app/OpenAiStyleStateStore.ts`

## 2026-03-11

### Additional update (OpenAI autopost style reset at flow entry)

#### What changed
- Changed `/mcp-openai` autopost entry behavior so `check_auth` always clears prior style state and returns `connected`.
- Removed the `render_style_picker` short-circuit that reused a previously confirmed style and skipped the picker UI.

#### Why
- A prior user-level style selection could leak into a new ChatGPT conversation and incorrectly push the flow straight to `create_post`.
- The intended UX is that each new autopost request restarts from style selection.

#### How
- Updated `mcp-proxy-server/src/platforms/openai-app/ToolRegistrar.ts` to treat `check_auth` as a fresh-post boundary and to always open a new style picker session.

## 2026-03-09

### Additional update (post-detail GitHub resource gate)

#### What changed
- Added optional per-post GitHub resource fields stored in `post_metadata`:
  - `githubUrl`
  - `githubDescription`
- Extended blog post create/edit flows to manage those fields.
- Added a gated GitHub CTA to the public post detail page:
  - authenticated viewers can copy the GitHub URL
  - anonymous viewers see login/register CTAs and return to the same post after auth
- Updated detail-read behavior so authenticated viewers bypass the public detail cache and receive gated GitHub URLs, while anonymous responses keep the URL hidden.

#### Why
- The post detail page needs a membership-style conversion surface for open-source links without leaking the GitHub URL to anonymous clients or cached public responses.
- Signup/login redirect continuity is required so the detail page can function as an acquisition landing page.

#### How
- Updated shared paths across:
  - `backend/src/posts/**`
  - `frontend/src/app/[blogSlug]/[postSlug]/**`
  - `frontend/src/app/new-story/page.tsx`
  - `frontend/src/components/posts/EditPostForm.tsx`
  - `frontend/src/app/(auth)/register/page.tsx`

### Additional update (MCP read rollout + app review runbooks)

#### What changed
- Added integration-side runbooks for:
  - published-post metadata shadow cleanup
  - OpenAI ChatGPT App review and live verification
- Confirmed MCP published-post read rollout remains scoped to `integration/workspace` until explicit release/deploy steps.

#### Why
- The current branch includes shared-path changes across `backend`, `frontend`, and `mcp-proxy-server`.
- Deploy/push sequencing needs explicit handoff docs so later work can continue without re-auditing the same rollout assumptions.

#### How
- Added/updated:
  - `docs/platform-coordination/POST_METADATA_SHADOW_CLEANUP_RUNBOOK.md`
  - `docs/openai-chatgpt-app/APP_REVIEW_RUNBOOK.md`

## 2026-02-26

### Additional update (feed period hot/top cache-warming env tracking)

#### What changed
- Added env tracking entries for feed period hot/top optimization flags:
  - `FEED_HOT_PERIOD_TTL_SECONDS` (default `600`)
  - `DISABLE_FEED_PERIOD_WARMING` (default `false`)
- Updated environment sync snapshot table in `WORKTREE_STATUS.md`.

#### Why
- Feed period hot/top path now has explicit runtime knobs for TTL and warming behavior.
- New keys must be tracked in platform coordination docs to avoid env drift across worktrees and deploy targets.

#### How
- Updated:
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-24

### Additional update (integration boundary + selective platform sync policy)

#### What changed
- Clarified default branch boundary:
  - execution and merge flow stops at `integration/workspace` by default
  - `main` merge/push requires explicit user request.
- Added explicit selective-sync policy:
  - no immediate fan-out to `ios/aos/web` after every integration merge
  - platform sync timing is limited to task-start, pre-PR, or shared dependency/contract alignment.
- Added divergence interpretation guidance and refreshed snapshot docs.
- Updated worktree snapshot to current branch heads:
  - `feature/integ/chatgpt-app`
  - `feature/web/oauth-follow-fix`
  - `feature/ios/workspace-safe`
  - `feature/aos/workspace-safe`

#### Why
- Team workflow requires avoiding accidental `integration/workspace -> main` promotion due to CI side effects.
- Immediate fan-out sync caused confusion when web/docs commits appeared as Android/iOS `behind` counts.
- We needed a deterministic rule for when branch sync is required vs optional.

#### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-23

### Additional update (ChatGPT App phase-1 + env sync tracking)

#### What changed
- Started `feature/integ/chatgpt-app` on integration worktree for shared-path-safe ChatGPT App rollout.
- Added/updated env governance snapshot for new MCP feature flag:
  - `OPENAI_APP_ENABLED` (default `false`)
- Updated worktree snapshot for current branch and dirty-state tracking.

#### Why
- ChatGPT App route rollout introduces a new runtime toggle that must be tracked across environments.
- Shared-path changes are implemented in integ worktree and need an explicit status snapshot.

#### How
- Updated:
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-21

### Additional update (safe branch baseline + divergence reference hardening)

#### What changed
- Updated worktree playbook to standardize platform-safe baselines:
  - `feature/ios/workspace-safe`
  - `feature/aos/workspace-safe`
  - `feature/web/workspace-safe`
- Updated `AGENTS.md` divergence command to explicit remote base check:
  - `git fetch origin --prune`
  - `git rev-list --left-right --count <active_branch>...origin/integration/workspace`
- Added parallel lane instruction in `AGENTS.md` and playbook for multi-worktree requests.
- Added "ask-then-proceed" rule for ambiguous or potentially missed user requests.
- Added explicit divergence check rule in playbook:
  - run `git fetch origin --prune` first
  - compare against `origin/integration/workspace` (report-first, no auto-sync)
- Added safe split recovery steps for mixed branches (create safe baseline, cherry-pick platform-owned commits only).
- Refreshed `WORKTREE_STATUS.md` snapshot to current safe branch heads and recorded legacy mixed branches as reference-only.

#### Why
- Local `integration/workspace` refs can differ across worktrees, causing divergence counts to look inconsistent.
- We needed one explicit baseline branch per platform to keep day-to-day work clean and prevent shared-path contamination.

#### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`

### What changed
- Added cross-platform environment-variable governance as an enforced rule in `AGENTS.md`.
- Expanded worktree playbook with a dedicated env policy:
  - canonical source-of-truth location
  - documented exception policy
  - no-script manual sync procedure across backend/frontend/ios/android/mcp.
- Added env synchronization checks to release gate preconditions.
- Added current env sync snapshot (including frontend local exception) to `WORKTREE_STATUS.md`.

### Why
- Multiple worktrees were causing env drift risk during integration testing.
- Shared keys can silently diverge across backend/frontend/mobile unless there is one explicit source of truth plus documented exceptions.
- Release validation needed an explicit env parity gate to prevent "works on one worktree only" failures.

### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/RELEASE_GATE.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`

## 2026-02-19

### What changed
- Aligned MCP/skills user guidance with current runtime behavior and official vendor docs:
  - Rewrote `mcp-proxy-server/README.md` to current dual-route architecture (`/mcp` + `/mcp-remote`).
  - Updated MCP auth/status output to avoid production URL confusion in local/dev:
    - `check_auth` blog URL now uses `FRONTEND_URL` base.
  - Updated startup/env log messages to describe dual auth mode explicitly.
  - Updated API key setup snippets for agent clients:
    - Claude Code command switched to explicit HTTP transport form.
    - Gemini CLI config path switched to `~/.gemini/settings.json`.
    - Codex config snippet removed obsolete `rmcp_client` guidance and now focuses on MCP block only.
  - Added inline caveat for Antigravity schema drift and explicit official-doc verification date in UI.

### Why
- Operators were seeing API Key-oriented text and production-style URLs even during OAuth/local workflows.
- Setup snippets had drifted from current OpenAI/Anthropic/Gemini documentation, increasing onboarding failure risk.
- README had stale endpoints (`/api/v1/mcp`) and outdated tool descriptions no longer matching code.

### How
- Updated:
  - `mcp-proxy-server/README.md`
  - `mcp-proxy-server/src/tools/index.ts`
  - `mcp-proxy-server/src/config/env.validation.ts`
  - `mcp-proxy-server/src/index.ts`
  - `frontend/src/app/settings/api-keys/configSnippets.ts`
  - `frontend/src/app/settings/api-keys/page.tsx`
- Official references validated on 2026-02-19:
  - OpenAI Codex Skills/Config/MCP docs
  - Anthropic Claude Code Skills/Settings docs
  - Gemini CLI docs (`skills`, `configuration`)

### Additional update (skills onboarding UX simplification)

#### What changed
- Reworked API key settings UX to separate onboarding paths:
  - Added explicit mode selector: `SKILLS 설치 (권장)` vs `MCP 직접 설정`.
  - Moved skill onboarding above MCP guide.
  - Removed `MCPorter` naming from user-facing onboarding section to avoid terminology confusion.
- Simplified skill onboarding copy:
  - kept only feature summary + install commands
  - removed verbose usage flow and optional API key fallback explanation from the skills block

#### Why
- Existing wording and placement made users interpret skills as an MCP sub-option.
- Overly long instructions increased onboarding friction for non-technical users.

#### How
- Updated:
  - `frontend/src/app/settings/api-keys/page.tsx`
  - `frontend/src/app/settings/api-keys/configSnippets.ts`

### Additional update (API key page redesign + secure copy UX)

#### What changed
- Refactored API key section to a compact table-driven layout (`이름 / 비밀 키 / 최근에 사용됨 / 작업`) inspired by a cleaner admin-console pattern.
- Replaced multi-card key creation flow with a single top-right `+ API 키 생성` action.
- Restored usage visibility in key table (`요청 수`, `포스트 수`, `만료일`).
- Applied secure copy policy:
  - raw key is kept only in current runtime memory after creation
  - no browser persistent storage (no localStorage/sessionStorage) for plaintext API keys
  - if runtime plaintext is unavailable, UI shows `원문 없음` and guides regeneration

#### Why
- Existing key area looked visually fragmented and over-detailed.
- One-time-only copy behavior caused repeated user friction during setup and reuse.
- Browser-persistent plaintext storage created unnecessary key leakage risk.

#### How
- Updated:
  - `frontend/src/app/settings/api-keys/page.tsx`
- Constraints documented in implementation:
  - backend stores only `keyHash` (bcrypt) and cannot reveal plaintext keys after creation.

### Additional update (skills installation flow standardization)

#### What changed
- Replaced SKILLS onboarding command set from `mcporter config/auth` to `vercel-labs/skills` installation flow.
- Added explicit command groups in web UI:
  - one-shot multi-agent install
  - per-agent install
  - verify
  - update/remove
- Updated external distribution repo guide:
  - `codebase-skills/README.md` now documents install/verify/update/remove with `npx skills`.

#### Why
- Previous SKILLS block behaved like MCP endpoint registration, which did not install `SKILL.md` files for agents.
- Users needed a single reliable installation path across Codex, Claude Code, Gemini CLI, and Antigravity.

#### How
- Updated:
  - `frontend/src/app/settings/api-keys/configSnippets.ts`
  - `frontend/src/app/settings/api-keys/page.tsx`
  - `/Users/sihyungpark/Desktop/code/codebase-skills/README.md`

## 2026-02-18

### What changed
- Introduced `integration/workspace` as the integration branch name.
- Enforced shared-code ownership:
  - `backend/**`, `mobile/contracts/**`, shared coordination docs must be edited only in `my-blog-app-integ`.
- Added situation-based doc routing in `AGENTS.md`.
- Simplified playbook and separated snapshot/release checks into dedicated docs.
- Added coordination doc index (`README.md`).

### Why
- Reduce operator confusion from previous branch naming and duplicated guidance.
- Prevent accidental shared-code edits from platform worktrees.
- Keep `AGENTS.md` short so LLM/operator compliance stays high.

### How
- Updated:
  - `AGENTS.md`
  - `docs/platform-coordination/worktree-branch-playbook.md`
  - `docs/platform-coordination/WORKTREE_STATUS.md`
  - `docs/platform-coordination/RELEASE_GATE.md`
  - `docs/platform-coordination/README.md`

### Additional update (OpenAI docs alignment)

#### What changed
- Added situation routing for Codex/MCP/skills/multi-agent docs in `AGENTS.md`.
- Added `docs/platform-coordination/CODEX_CONFIGURATION.md`.
- Added `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`.
- Updated `docs/platform-coordination/README.md` index.

#### Why
- Reduce repeated prompting by pinning where to read each operational standard.
- Align repository operation model with OpenAI Codex official docs.

#### How
- Reviewed:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/rules
  - https://developers.openai.com/codex/mcp
  - https://developers.openai.com/codex/skills
  - https://developers.openai.com/codex/multi-agent

### Additional update (PR workflow + guardrails)

#### What changed
- Added repository PR template:
  - `.github/pull_request_template.md`
- Added PR guardrail workflow:
  - `.github/workflows/platform-pr-guardrails.yml`
- Added PR/approval policy runbook:
  - `docs/platform-coordination/PR_REVIEW_POLICY.md`
- Updated routing/index/checklist docs:
  - `AGENTS.md`
  - `docs/platform-coordination/README.md`
  - `docs/platform-coordination/RELEASE_GATE.md`
  - `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`
- Unignored `.codex/` in `.gitignore` for project-tracked Codex config.

#### Why
- Preserve auditable review history per platform PR.
- Enforce branch and shared-path discipline automatically.
- Separate sub-agent assist from final human approval/merge.

#### How
- Introduced CI guardrails for:
  - base branch policy
  - shared path ownership
  - required PLATFORM-TRACK fields in PR body

### Additional update (auto PR + auto merge)

#### What changed
- Added auto PR workflow:
  - `.github/workflows/auto-open-platform-pr.yml`
- Extended guardrail workflow for auto-merge:
  - `.github/workflows/platform-pr-guardrails.yml`
- Updated policy docs:
  - `docs/platform-coordination/PR_REVIEW_POLICY.md`
  - `docs/platform-coordination/MULTI_AGENT_PLAYBOOK.md`

#### Why
- Reduce manual overhead for platform-to-integration synchronization.
- Keep consistent audit trail through PR-first integration.

#### How
- Platform branch pushes now open PR automatically to `integration/workspace`.
- Eligible PRs auto-merge in automation path after guardrail-equivalent checks.
- `manual-review` label provides opt-out path for sensitive changes.

### Additional update (Codebase skill sync + policy hardening)

#### What changed
- Restored missing Codebase skill docs into this worktree:
  - `.agents/skills/codebase-skill/*`
  - `docs/skills/codebase-skill/*`
- Added `agents/openai.yaml` for Codebase skill in both locations:
  - `.agents/skills/codebase-skill/agents/openai.yaml`
  - `docs/skills/codebase-skill/agents/openai.yaml`
- Set `policy.allow_implicit_invocation: false` to require explicit invocation for posting flows.

#### Why
- `integration/workspace` worktree did not contain the skill docs copied in another branch/worktree, causing local parity validation mismatch.
- Auto-posting is high-impact; explicit invocation reduces accidental posting risk.

#### How
- Copied canonical skill files from checkpoint branch worktree into `my-blog-app-integ`.
- Re-ran MCP↔Skills parity script after sync to confirm path/tool consistency.

### Additional update (Skill route strict OAuth guard)

#### What changed
- Strengthened Codebase skill docs to prohibit OAuth->API Key fallback on `skill` route:
  - `.agents/skills/codebase-skill/SKILL.md`
  - `.agents/skills/codebase-skill/MCPORTER_SKILL.md`
  - `.agents/skills/codebase-skill/HEARTBEAT.md`
  - `docs/skills/codebase-skill/SKILL.md`
  - `docs/skills/codebase-skill/MCPORTER_SKILL.md`
  - `docs/skills/codebase-skill/HEARTBEAT.md`
- Added explicit OAuth alias-only fallback policy in `skill` route:
  - `codebase-blog-oauth` -> `codebase-blog-oauth-prod` only
- Corrected `agents/openai.yaml` format to official Codex Skills structure (`interface`, `policy`, `dependencies`) in both skill locations.

#### Why
- Prevent accidental route drift where `skill` intent could be executed as direct MCP/API Key.
- Align skill metadata format with official Codex Skills docs and reduce implicit behavior ambiguity.

#### How
- Added hard safety contract sections to skill docs.
- Added `allow_implicit_invocation: false` and route-specific default prompt to `agents/openai.yaml`.

### Additional update (MCP post URL env-aware fix)

#### What changed
- Updated MCP `create_post` success message URL generation to use `FRONTEND_URL` instead of hardcoded `https://codebase.blog`.
- Added `FRONTEND_URL` to MCP proxy runtime config flow:
  - `mcp-proxy-server/src/config/env.validation.ts`
  - `mcp-proxy-server/src/index.ts`
  - `mcp-proxy-server/src/oauth/index.ts`
  - `mcp-proxy-server/src/tools/index.ts`
- Added missing env examples:
  - `BACKEND_PUBLIC_URL`
  - `FRONTEND_URL`
  in `mcp-proxy-server/.env.example`.

#### Why
- Dev environment posts were showing production domain in success output, causing operator confusion and route validation mistakes.

#### How
- Introduced frontend base URL composition for relative post paths.
- Kept absolute URLs from backend unchanged when already provided.

### Additional update (Mixed changes snapshot + path ownership split)

#### What changed
- Created snapshot branch `checkpoint/mixed-snapshot-20260220` to preserve all in-progress changes.
- Re-applied only shared/integration-owned paths onto `integration/workspace`:
  - `.agents/skills/codebase-skill/**`
  - `backend/**`
  - `mcp-proxy-server/**`
  - `docs/platform-coordination/CHANGELOG.md`
- Planned separate re-apply for web-owned paths (`frontend/**`) on `feature/web/workspace`.

#### Why
- Recent edits were made in `my-blog-app-integ` while including web-owned files.
- We need to preserve all history without loss and restore ownership boundaries defined in the worktree playbook.

#### How
- Snapshot commit first (no data loss), then selective path checkout by ownership.
- Commit/push split by worktree role before PR routing (`platform -> integration -> main`).

### Additional update (Public product/docs surface for web)

#### What changed
- Added a new public marketing/docs entry at `/product` with a dedicated public header/footer shell.
- Added public docs routes under `/docs`:
  - `/docs`
  - `/docs/get-started`
  - `/docs/publishing-flow`
  - `/docs/mcp`
  - `/docs/faq`
  - `/docs/writing-styles`
  - `/docs/writing-styles/[style]`
- Reworked `/pricing` into a public pricing surface using live plan data.
- Moved `/support` and `/updates` onto the same public shell.
- Redirected `/landing` to `/product#use-cases`.
- Updated public SEO/internal links:
  - `frontend/src/app/sitemap.ts`
  - `frontend/src/app/robots.ts`
  - `frontend/src/components/layout/PromoCarouselSection.tsx`
  - `frontend/src/proxy.ts`

#### Why
- Root `/` app home must stay untouched, but the product still needed an Antigravity-style public marketing/docs surface.
- The old `/landing` and internal-style `/pricing` did not match the new public information architecture.

#### How
- Split public pages from the app chrome in `frontend/src/app/layout-client.tsx`.
- Introduced reusable public-site components for header, footer, frame, docs layout, and markdown rendering.
- Kept the app header/sidebar behavior for the existing app routes, while serving the new shell only on `/product`, `/docs/**`, `/pricing`, `/updates`, and `/support`.

## 2026-04-16 / web

- 변경 타입: refactor
- 범위: UI
- 변경 요약:
  - D2 지도의 노드 클릭 동작을 `포커스 이동 + 상세 열기`로 단일화했다.
  - 오른쪽 패널을 `구조 / 상세` 탭으로 명시화하고 `panel` URL 상태를 추가했다.
  - `주제 상세`, `현재 주제`, `N개 근거` 같은 중복/모호 표현을 제거하고 상세 패널의 `연결된 글` 중심으로 정리했다.
- 근거: 지식 지도와 오른쪽 사이드바의 용어 및 클릭 결과가 일치하지 않아 사용자가 현재 위치와 상세 진입 결과를 예측하기 어려웠다.
- 영향:
  - web: 데스크톱/모바일 모두 오른쪽 패널 상태가 명시적으로 보이고, 노드 클릭 시 상세가 같은 모델로 열린다.
  - ios: 영향 없음. 웹 전용 KB map 상호작용 변경이다.
  - android: 영향 없음. 웹 전용 KB map 상호작용 변경이다.
- 회귀 리스크:
  - `panel/focus/detail` URL 정규화가 브라우저 뒤로가기와 모바일 drawer 동작에 미세한 영향을 줄 수 있다.
- 테스트/검증:
  - `pnpm --dir frontend type-check`
  - `pnpm --dir frontend exec eslint src/components/layout/KnowledgeFlowBoardSection.tsx src/components/layout/knowledge-flow-board/KnowledgeFlowBoardD2View.tsx src/components/layout/knowledge-flow-board/KnowledgeMapNodeDetailPanel.tsx src/components/layout/knowledge-flow-board/KnowledgeMapSidebarPanel.tsx src/components/layout/knowledge-flow-board/KnowledgeMapTreeSidebar.tsx src/components/layout/knowledge-flow-board/useKnowledgeFlowBoardFocus.ts src/lib/knowledge-ui.ts 'src/app/[blogSlug]/kb/map/page.tsx' 'src/app/[blogSlug]/kb/[nodeSlug]/page.tsx' tests/e2e/kb-map.spec.ts`
  - `pnpm --dir frontend test:e2e:kb-map`
- 다음 액션:
  - 실제 운영 데이터 기준으로 오른쪽 패널 텍스트 밀도와 빈 상태 카피를 한 번 더 시각 검토한다.
- 관련 파일:
  - `frontend/src/lib/knowledge-ui.ts`
  - `frontend/src/components/layout/KnowledgeFlowBoardSection.tsx`
  - `frontend/src/components/layout/knowledge-flow-board/*`
  - `frontend/tests/e2e/kb-map.spec.ts`

## 2026-04-16 / web

- 변경 타입: refactor
- 범위: UI
- 변경 요약:
  - KB map 오른쪽 패널에서 `상세` 탭과 상세 패널 렌더링을 전부 제거했다.
  - 지식 노드 클릭은 어디서든 `focus` 변경만 수행하도록 통일했다.
  - `detail` / `panel` URL 상태와 관련 클라이언트 로직, 상세 패널 컴포넌트를 걷어냈다.
- 근거: 오른쪽 패널에서 구조를 누르면 상세로 넘어가는 동작이 구조 탐색 UX와 충돌했고, 중심 지도와 구조 패널의 역할을 불필요하게 복잡하게 만들었다.
- 영향:
  - web: KB map이 구조 탐색 전용 UX로 단순화되며, 가운데 지도와 오른쪽 패널이 같은 구조 정보를 일관되게 보여준다.
  - ios: 영향 없음. 웹 전용 KB map 변경이다.
  - android: 영향 없음. 웹 전용 KB map 변경이다.
- 회귀 리스크:
  - 기존 `detail/panel` deep-link는 구조-only map으로 정규화되므로, 북마크된 과거 링크가 다른 최종 URL로 수렴한다.
- 테스트/검증:
  - `pnpm --dir frontend type-check`
  - `pnpm --dir frontend exec eslint src/components/layout/KnowledgeFlowBoardSection.tsx src/components/layout/TrendingKnowledgeSection.tsx src/components/layout/knowledge-flow-board/KnowledgeMapTreeSidebar.tsx src/components/layout/knowledge-flow-board/useKnowledgeFlowBoardFocus.ts src/lib/knowledge-ui.ts 'src/app/[blogSlug]/kb/map/page.tsx' 'src/app/[blogSlug]/kb/[nodeSlug]/page.tsx' tests/e2e/kb-map.spec.ts`
  - `pnpm --dir frontend test:e2e:kb-map`
- 다음 액션:
  - 구조-only KB map을 실제 운영 데이터로 한 번 더 시각 점검해, 오른쪽 패널의 정보 밀도와 모바일 drawer 닫힘 타이밍을 미세 조정한다.
- 관련 파일:
  - `frontend/src/lib/knowledge-ui.ts`
  - `frontend/src/components/layout/KnowledgeFlowBoardSection.tsx`
  - `frontend/src/components/layout/knowledge-flow-board/KnowledgeMapTreeSidebar.tsx`
  - `frontend/src/components/layout/knowledge-flow-board/useKnowledgeFlowBoardFocus.ts`
  - `frontend/tests/e2e/kb-map.spec.ts`
