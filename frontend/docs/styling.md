# Styling & UI Components

Code: `src/index.css`, `vite.config.js` (Tailwind plugin), `src/components/ui/*`, `src/motion/index.js`.

## Tailwind v4, CSS-first config

There is no `tailwind.config.js` — Tailwind v4's `@tailwindcss/vite` plugin reads the theme
straight out of an `@theme` block in `src/index.css`:

```css
@import "tailwindcss";
@import "@fontsource-variable/sen";

@theme {
  --color-canvas: #ffffff;        /* page background */
  --color-surface: #f7f7fa;        /* card/section backgrounds */
  --color-surface-strong: #f0f0f5;
  --color-border: #e3e3ea;
  --color-border-strong: #cfcfda;

  --color-ink: #171719;            /* primary text */
  --color-ink-soft: #55555f;       /* secondary text */
  --color-ink-faint: #9c9ca8;      /* placeholder/disabled text */

  --color-brand: #5a55f0;          /* indigo/violet — primary actions */
  --color-brand-hover: #4842e0;
  --color-brand-active: #3c36cc;
  --color-brand-tint: #eeedff;

  --color-success: #16a34a;   --color-success-tint: #eafaf0;
  --color-warning: #d97706;   --color-warning-tint: #fef6e7;
  --color-danger: #e0342e;    --color-danger-tint: #fdeceb;

  --radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 16px;  --radius-full: 9999px;
  --shadow-float: 0 4px 16px -4px rgb(23 23 25 / 0.12), 0 1px 2px 0 rgb(23 23 25 / 0.06);
  --font-sans: "Sen Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --container-page: 1200px;
}
```

Every token above becomes a real Tailwind utility automatically (`bg-canvas`, `text-ink-soft`,
`border-border`, `rounded-md`, `shadow-float`, `font-sans`, ...) — used throughout
`components/ui/*` and every page, e.g. `Button`'s primary variant is literally
`bg-brand text-white hover:bg-brand-hover active:bg-brand-active`.

**If you find a `design.md`-style doc elsewhere describing different tokens (charcoal/silver/
emerald-pulse, a "Memotron" product, 21px spacing scales) — that's stale, from an unrelated
product, and does not describe this app.** The `@theme` block above is the actual, current design
system. See [../../frontend/docs/index.md](./index.md#a-note-on-the-old-docs).

## No external UI library

`src/components/ui/` is a from-scratch component set — 24 components (`Button`, `Input`, `Modal`,
`Drawer`, `Table`, `Toast`, `Dropdown`, `Avatar`, `Badge`, `ProgressBar`, `Tooltip`, `Spinner`,
`Skeleton`, `EmptyState`, `SegmentedControl`, `Pagination`, `Breadcrumbs`, `FileTypeIcon`,
`FullScreenLoader`, `PageTransition`, `ConfirmDialog`, `IconButton`, `InlineAlert`, `Card`),
barrel-exported from `components/ui/index.js` so pages import from one place:
`import { Button, Card, Toast } from "../../../components/ui"`.

This wasn't always the case — `eslint.config.js` has a standing rule specifically to prevent
regressing it:

```js
'no-restricted-imports': ['error', { paths: ['antd', '@ant-design/icons'] }],
// "antd was fully removed in the Tailwind/Framer Motion redesign — block regressions."
```

Component styling pattern (see `Button/index.jsx` for a representative example): a small
`VARIANTS`/`SIZES` lookup object of Tailwind class strings, applied via template literal, animated
with `motion.button`/`motion.div` (framer-motion) rather than CSS transitions for anything
interactive (tap scale, layout shifts).

## Motion (`src/motion/index.js`)

Shared framer-motion variants, reused instead of each component inventing its own timing/easing:

| Export | Use |
|---|---|
| `fadeIn`, `fadeUp`, `fadeScale` | Generic enter/exit for cards, sections |
| `staggerContainer(staggerChildren, delayChildren)` | Wraps a list so children animate in sequence (e.g. the pricing cards in Subscriptions, `staggerContainer(0.06)`) |
| `listItem` | Per-item variant paired with `staggerContainer` |
| `backdrop`, `modalPanel` | Modal/dialog open-close |
| `drawerPanel` | The mobile sidebar `Drawer` slide-in |
| `toastVariant` | Toast enter/exit |

`durations` (fast `0.12s` / base `0.2s` / slow `0.32s`) and `easings` (`expoOut`, `easeInOut`,
spring presets) are the shared primitives everything above is built from — change these two
objects to retune motion feel app-wide. `App.jsx` wraps the whole tree in
`<MotionConfig reducedMotion="user">`, which automatically respects the OS-level
"prefers-reduced-motion" setting without any per-component check.
