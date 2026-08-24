# Product landing design specification

## Direction

The `/en/product` and `/ko/product` pages use an editorial layout derived from the supplied magazine reference: a split cover, strong rules, numbered stories, a restrained paper palette, and asymmetrical information panels. The implementation avoids fabricated usage metrics, logo clouds, testimonials, decorative gradients, and generic floating cards.

## Logo proposal

Keep the existing chat-bubble mark and the legible “A” inside it. Use it as a 40–48 px editorial stamp next to a plain Codebase wordmark, with no glow or gradient. The landing page demonstrates the proposed lockup in the hero record panel; the underlying brand glyph is not redrawn, so other product surfaces remain consistent.

Minimum clear space is one quarter of the mark width on every side. Do not render the mark below 32 px. On light surfaces use the current full-color asset; on dark surfaces place it on the paper-colored tile used by the hero record.

## Accessible palette

Contrast ratios below use relative luminance calculations. All normal text combinations exceed the project’s 4.5:1 minimum.

| Role | Foreground | Background | Contrast |
| --- | --- | --- | ---: |
| Light primary text | `#10231D` | `#F4F1E8` | 14.52:1 |
| Light body text | `#385047` | `#F4F1E8` | 7.73:1 |
| Light section label | `#315D4D` | `#F4F1E8` | 6.63:1 |
| Primary action | `#FFFFFF` | `#123D30` | 12.10:1 |
| White surface primary | `#14231E` | `#FFFFFF` | 16.29:1 |
| White surface body | `#53675F` | `#FFFFFF` | 6.05:1 |
| Dark primary text | `#B9C9C2` | `#101A17` | 10.32:1 |
| Dark label | `#9ECBB9` | `#101A17` | 9.89:1 |
| Self-host primary | `#FFFFFF` | `#0D2B22` | 15.15:1 |
| Self-host body | `#C0D3CB` | `#0D2B22` | 9.69:1 |

Deep green communicates the brand while borders, icons, labels, and text reinforce every state; color is never the only signal.

## Typography

- Primary family: Pretendard Variable with the existing system sans-serif fallbacks.
- Display: 48–118 px responsive, weight 600, line-height 0.93–1.03, negative tracking reserved for large headings.
- Section heading: 36–60 px, weight 600, line-height 1.03.
- Body: 16–20 px, weight 400–500, line-height 1.55–1.75.
- UI and links: minimum 14 px, weight 600.
- Editorial labels: 12–14 px monospaced, weight 600, 16–20% tracking. Labels are supplementary and never carry the only copy for a feature.

## Layout and spacing

- Content width: maximum 1440 px.
- Desktop grid: two-column cover followed by three-column editorial features.
- Mobile: every split collapses to a single reading column; no horizontal content scroll.
- Base spacing unit: 8 px desktop and 4 px mobile.
- Section padding: 80–112 px vertically; 20–56 px horizontally.
- Primary element gap: at least 16 px.
- Borders: 1 px rules establish hierarchy. Shadows appear only on the hero/editor specimen and remain hard-edged to match the editorial reference.
- Touch targets: 48 px minimum height for primary controls.

## Locale and content rules

- `/en/product` is the canonical English route and `/ko/product` is the canonical Korean route.
- `/product` redirects using the explicit locale cookie, then `Accept-Language`, then English.
- Product metadata, headings, navigation, footer, calls to action, and the language switch are locale-specific.
- Product claims must describe implemented behavior. Do not publish invented customer counts, time savings, revenue, integrations, or testimonials.
- The self-hosted repository link must remain unavailable until the repository is publicly readable and its root MIT license is verified. Until then, copy must describe the MIT release as pending.

## Accessibility checklist

- [x] Text contrast meets or exceeds 4.5:1 for normal text.
- [x] Body text is at least 16 px and UI text is at least 14 px.
- [x] Heading order is one `h1`, followed by section `h2` and item `h3` elements.
- [x] Keyboard focus is visible on primary calls to action.
- [x] Links retain descriptive text and are not distinguished by color alone.
- [x] Decorative grid and icons are hidden from assistive technology.
- [x] The language switch declares `hrefLang`.
- [x] Responsive layouts preserve source order and reading order.
- [x] Motion is not required to understand or use the page.
- [ ] Re-run browser contrast and zoom checks after any palette or typography change.
- [ ] Verify the self-host repository visibility and root MIT license before enabling its link.
