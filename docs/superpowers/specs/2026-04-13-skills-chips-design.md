# Skills Chip Input — Design Spec

**Date:** 2026-04-13

## Overview

Add a skills section to the resume maker where users can input multiple skills as tag/chips. Skills persist across sessions and are injected into the AI prompt so they appear in the generated resume's `## SKILLS` section.

## State

- `skills: string[]` — stored in component state
- Initialized from `localStorage.getItem('skills')` (JSON parsed); falls back to `[]`
- Persisted via `useEffect(() => { localStorage.setItem('skills', JSON.stringify(skills)) }, [skills])`

## UI

New `<motion.section>` inserted between the "Professional Links" section and the "Job Description" section in `App.tsx`.

**Structure:**
- Header row: label `SKILLS / Optional` (mono-label class)
- Tag input area: a flex-wrap container showing existing chips + an inline text input
- Chips: pill shape, `10px uppercase JetBrains Mono`, `border border-ink/10`, `×` button to remove individual skill
- Input placeholder: `"Add a skill..."` when chip list is empty, `""` otherwise

**Interactions:**
- Type skill name → press `Enter` or `,` → skill trimmed and added as chip (ignore empty/duplicate)
- `Backspace` on empty input → removes last chip
- Click `×` on chip → removes that skill

## Prompt Integration

In `generateTailoredResume`, after `linksContext` is built:

```ts
const skillsContext = skills.length > 0
  ? skills.join(', ')
  : '';
```

Injected into the prompt as a new section:

```
Candidate's known skills (incorporate into ## SKILLS section, grouped by category):
${skillsContext}
```

Only injected when `skillsContext` is non-empty. AI already groups by category (`**Languages:** ...`, `**Frameworks:** ...`) matching the existing Harvard-style format rules.

## Persistence

Same pattern as `socialLinks` — `useEffect` watches `skills` and writes to `localStorage`. Initialized lazily in `useState` from `localStorage` with a try/catch fallback to `[]`.

## Files Changed

- `src/App.tsx` — only file modified
