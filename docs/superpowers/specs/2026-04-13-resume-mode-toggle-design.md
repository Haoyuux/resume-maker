# Resume Mode Toggle — Design Spec

**Date:** 2026-04-13

## Overview

Add a mode toggle letting users choose between **General** (clean polished resume, no job targeting) and **ATS** (current behavior, tailored to a specific job description). Hides the job description field in General mode.

## State

- `mode: 'general' | 'ats'` — stored in component state
- Initialized from `localStorage.getItem('resumeMode')`, falls back to `'ats'`
- Persisted via `useEffect(() => { localStorage.setItem('resumeMode', mode) }, [mode])`

## UI

Segmented toggle rendered above the Professional Links section in the left panel:

```
[ GENERAL ]  [ ATS ]
```

- Two pill/button elements side by side
- Active: filled accent background (`bg-accent text-white`)
- Inactive: transparent with ink/20 border
- Font: `text-[10px] uppercase font-mono tracking-widest`

**Conditional rendering:**
- `mode === 'ats'`: Job Description section visible (current behavior)
- `mode === 'general'`: Job Description section hidden via conditional render

## Generate Button

- `mode === 'ats'`: disabled when `!resumeText || !jobDescription` (current behavior)
- `mode === 'general'`: disabled when `!resumeText` only

## AI Prompt

**General mode prompt** — replaces the ATS prompt entirely:

> You are an expert professional resume writer. Reformat and polish the provided resume into a clean, professional, general-purpose resume using Harvard resume style Markdown. Preserve all facts exactly. Do not tailor to any specific job. Follow the same Harvard style formatting rules (name, contact, sections, bullet points, skills grouped by category).

**ATS mode prompt** — unchanged (current prompt).

Both modes still inject `linksContext` and `skillsContext`.

## Persistence

`localStorage.setItem('resumeMode', mode)` on every change. Initialized lazily in `useState` with fallback to `'ats'`.

## Files Changed

- `src/App.tsx` — only file modified
