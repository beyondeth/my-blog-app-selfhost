# Home Feed Redesign Notes

## Updated logo proposal
- Mark: rounded chat bubble with a centered "A" glyph and a small tail, reinforcing conversation-first identity.
- Colors: bubble #0F172A with white glyph for maximum contrast.
- Minimum size: 32px square for clarity; recommended 48px for header branding.
- Usage: keep clear space equal to half the bubble width on all sides.

## Accessible color palette (luminance + contrast)
| Token | Hex | Luminance | Pairing | Contrast |
| --- | --- | --- | --- | --- |
| Background (Slate 50) | #F8FAFC | 0.954 | Text #0F172A | 17.06 |
| Surface (White) | #FFFFFF | 1.000 | Text #0F172A | 17.85 |
| Primary text (Slate 900) | #0F172A | 0.009 | On #FFFFFF | 17.85 |
| Secondary text (Slate 600) | #475569 | 0.089 | On #FFFFFF | 7.58 |
| Brand primary (Emerald 800) | #065F46 | 0.087 | White text #FFFFFF | 7.68 |
| Brand secondary (Blue 800) | #1E3A8A | 0.051 | White text #FFFFFF | 10.36 |
| Badge (Emerald 100) | #D1FAE5 | 0.876 | Text #064E3B | 8.57 |
| Badge (Blue 100) | #DBEAFE | 0.811 | Text #1E3A8A | 8.49 |

## Dark mode palette (luminance + contrast)
| Token | Hex | Luminance | Pairing | Contrast |
| --- | --- | --- | --- | --- |
| Background (Slate 950) | #020617 | 0.002 | Text #F1F5F9 | 18.41 |
| Surface (Slate 900) | #0F172A | 0.009 | Text #F1F5F9 | 16.30 |
| Secondary text (Slate 300) | #CBD5E1 | 0.657 | On #020617 | 13.59 |
| Muted text (Slate 400) | #94A3B8 | 0.360 | On #020617 | 7.87 |
| Brand accent (Emerald 400) | #34D399 | 0.496 | On #0F172A | 9.29 |
| Accent text (Emerald 200) | #A7F3D0 | 0.769 | On #0F172A | 13.92 |
| Accent text (Blue 200) | #BFDBFE | 0.689 | On #0F172A | 12.56 |

## Typography guidelines
- Typeface: Pretendard (font-sans), fallback to system sans-serif.
- Body text: 16px, line-height 1.6, tracking 0.01em.
- UI text: 14px minimum, line-height 1.4, tracking 0.01em.
- Headings: 24-36px, weight 600, tracking 0.01em.
- Weights: 400-600; avoid ultra-light weights.

## Layout and spacing system
- Spacing scale: 8px base (4px for dense mobile contexts).
- Minimum spacing: 16px between primary elements.
- Cards: 20-24px padding, 16-24px corner radius, subtle shadow (shadow-sm).
- Content width: max 6xl container, generous breathing room for scanning.

## Accessibility compliance checklist
- Contrast ratios verified at 4.5:1 or higher for text and key UI.
- Focus-visible ring styles added for keyboard navigation.
- Touch targets meet 44px height when used as primary actions.
- No color-only meaning; labels and icons are paired with text.
- Body and UI text sizes meet minimum size requirements.
