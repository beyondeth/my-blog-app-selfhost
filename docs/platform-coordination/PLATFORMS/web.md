# Web Platform Log

## 2026-04-18

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
