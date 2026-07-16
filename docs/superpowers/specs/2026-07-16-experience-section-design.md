# Experience Section — Design

**Date:** 2026-07-16
**Status:** Approved

## Purpose

Give users a place in the input column to manually add work experience that is
missing from (or supplements) their uploaded resume. Entries are structured and
feed directly into the Gemini prompt as candidate-provided facts.

## Decisions

- **Input style:** structured entry cards (Company, Job Title, Dates, bullet list).
- **Manual only:** no auto-extraction from the uploaded resume. The uploaded
  resume already contains its own experience; this section is for what's missing.

## Placement

New "Experience / Optional" section in the left input column, between Skills and
the Job Description. Final order: Resume → Mode → Links → Skills → **Experience**
→ Job Description (ATS mode only) → Tailor button.

## Data model

```ts
type Experience = {
  company: string;
  title: string;
  dates: string;     // free text, e.g. "Jan 2022 – Present"
  bullets: string[];
};
```

- `experiences: Experience[]` in App state.
- Persisted to localStorage under key `experiences`, same lazy-init pattern as
  `skills` and `socialLinks`.

## UI

Matches the existing editorial style (mono-label headers, 1px ink/10 borders,
accent focus states, hover-revealed trash buttons):

- Section header: `mono-label` "Experience / Optional", a "+ Add Entry" accent
  button, and a "Clear All" button shown only when entries exist (same header
  pattern as Professional Links).
- Each entry is a bordered card containing:
  - Company, Job Title, Dates — three text inputs (dates free text).
  - A trash button to delete the card, visible on hover (group-hover pattern).
  - Bullets: each bullet is its own input row prefixed with "•" and a small
    remove (×) button; "+ Add bullet" link below. Pressing Enter in a bullet
    input adds a new bullet after it and is focused.
- New entries start with one empty bullet.
- Empty state: only the header row renders (no cards, no placeholder box).

## Prompt integration

In `generateTailoredResume()`, build `experienceContext` from entries where
company or title is non-empty (blank entries skipped; blank bullets skipped):

```
Company — Title (Dates)
- bullet
- bullet
```

Injected into BOTH the ATS and General prompts, alongside links/skills context,
as:

```
Additional experience provided by the candidate (include in ## EXPERIENCE, treat as factual):
<formatted entries>
```

Omitted entirely when there are no non-blank entries. The existing accuracy
rules continue to forbid fabrication; this block is explicitly marked as
candidate-provided facts so it is allowed material.

## Error handling

None needed beyond skipping blank entries — no AI calls, no file IO.

## Testing / verification

No test infrastructure exists in this repo. Verification is manual:
`npm run lint` (tsc --noEmit) and exercising the flow in `npm run dev`.
