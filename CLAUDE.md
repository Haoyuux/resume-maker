# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # Type-check with tsc --noEmit
npm run clean      # Remove dist/
```

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. Vite exposes this via `process.env.GEMINI_API_KEY` (see `vite.config.ts` `define` block — it's not a real Node env var, it's statically replaced at build time).

## Architecture

This is a single-page React 19 app with no backend. All logic lives in `src/App.tsx`.

**Data flow:**
1. User uploads a PDF/TXT resume → `pdfjs-dist` extracts text client-side → stored in `resumeText` state
2. User pastes a job description → stored in `jobDescription` state
3. On submit → calls `@google/genai` (`gemini-3-flash-preview` model) directly from the browser with the resume text + job description as a prompt
4. Streamed markdown response → rendered via `react-markdown` in `.resume-preview`

**Styling system** (Tailwind v4 via `@tailwindcss/vite`):
- Custom theme tokens in `src/index.css`: `--color-paper` (#F5F5F3), `--color-ink` (#1A1A1A), `--color-accent` (#FF5F1F)
- Fonts: Fraunces (serif/display), JetBrains Mono, Inter
- Layout: `.editorial-grid` / `.editorial-cell` — a 12-column CSS grid with 1px gap lines as borders
- `.display-title` — variable-font Fraunces with `SOFT`/`WONK` axes
- `.mono-label` — 10px uppercase JetBrains Mono labels
- `.resume-preview` — Harvard-resume-inspired print styles for the AI output pane

**Key utility:** `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge).

**Print/export:** `handlePrint()` opens a new window, injects Tailwind CDN + Google Fonts, copies `.resume-preview` innerHTML, and triggers `window.print()`.
