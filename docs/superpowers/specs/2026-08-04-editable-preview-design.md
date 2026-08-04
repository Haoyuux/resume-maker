# Editable Resume Preview

## Problem

The right-hand "Refined Output" panel (`.resume-preview`) renders the AI-generated
resume via `ReactMarkdown` from the `generatedResume` string, but the rendered
output is read-only. Users want to click directly into the rendered resume and
edit it in place — headings, bullets, bold text — the way a document editor
works, without dropping down to raw Markdown.

## Approach

Make `.resume-preview` an **uncontrolled `contentEditable` div**, seeded via a
`ref` rather than driven by React children on every render.

- A `useEffect` keyed on `generatedResume` renders the markdown to an HTML
  string once (via `renderToStaticMarkup` from `react-dom/server`, reusing the
  existing `ReactMarkdown` instance and its custom `a` component) and writes it
  with `previewRef.current.innerHTML = html`.
- After that initial write, the div has `contentEditable={true}` and receives
  no further children from React. The browser owns all subsequent DOM mutations
  from typing — React never reconciles into that subtree, so there's no risk of
  the classic React+contentEditable conflict (React's vdom diff fighting the
  browser's live DOM edits, causing `removeChild`/`insertBefore` crashes).

**Alternatives considered:**
- *Controlled contentEditable* (re-render `ReactMarkdown` from state on every
  keystroke) — rejected; this is exactly the pattern that causes cursor-jump
  and DOM-reconciliation crashes.
- *Rich-text library (TipTap/Slate)* — more robust long-term (undo/redo, paste
  handling, a real toolbar) but adds a dependency and a node-schema layer to an
  app that is currently a single lean file with no other editor needs. Rejected
  as overkill for plain click-and-type editing with no formatting toolbar.

## Behavior

- **Regeneration resets edits.** Clicking "Tailor Resume" again re-runs the
  effect and overwrites `innerHTML` with the fresh AI output, discarding any
  manual edits from the previous generation. This is expected: a new AI
  generation replaces the document.
- **Paste is sanitized to plain text.** An `onPaste` handler calls
  `preventDefault()` and inserts `event.clipboardData.getData('text/plain')`
  only, discarding any foreign HTML/styles. This keeps pasted content visually
  consistent with the resume's typography and avoids writing arbitrary markup
  into a DOM that Print/PDF export read from directly.
- **Copy / Download-as-text read the live edited DOM.** `copyToClipboard` and
  `downloadAsText` currently read the `generatedResume` string; both switch to
  reading `previewRef.current.innerText` at call time, so they always reflect
  on-screen edits. Since the exported content is now plain text (not markdown
  syntax), the download's filename extension changes from `.md` to `.txt`
  (`tailored-resume.txt`) to accurately reflect the format.
- **PDF/Print export are unaffected in mechanism.** Both already read
  `.resume-preview` from the live DOM (`document.querySelector('.resume-preview')`
  or the `html2pdf` call against `previewEl`), so edits are picked up
  automatically with no code change to the capture logic itself.
- **PDF filename derivation changes source.** Currently derived via
  `generatedResume.match(/^#\s+(.+)/m)` against the original markdown. Switch to
  reading the live `<h1>` text (`previewEl.querySelector('h1')?.textContent`),
  so a user who edits their name in the preview gets a matching filename.
- **Discoverability.** Add a small `EDITABLE` mono-label next to the existing
  `GENERATION COMPLETE` label (same styling convention), shown whenever
  `generatedResume` is non-empty. Add a subtle focus style on `.resume-preview`
  (soft ring/outline in the accent color) so it's visually clear the panel is
  focused/editable while typing.
- **Empty state unaffected.** `contentEditable` is only set true when
  `generatedResume` is non-empty, so the existing "Awaiting Input" placeholder
  overlay continues to work unchanged.
- **No formatting toolbar.** Out of scope per explicit user decision — this is
  click-and-type editing only, no Bold/Italic/list buttons.

## Data flow after this change

1. Generation completes → `setGeneratedResume(markdown)`.
2. Effect fires → `previewRef.current.innerHTML` set from rendered markdown.
3. User clicks into the preview and types → browser mutates the DOM directly;
   no React state changes during editing.
4. Copy / Download-as-text / PDF / Print all read the current DOM
   (`previewRef.current` / `document.querySelector('.resume-preview')`) at the
   moment the user triggers the action — not `generatedResume`.
5. A new "Tailor Resume" submission overwrites step 2's output again, discarding
   edits.

## Out of scope

- Formatting toolbar / keyboard shortcuts for bold, italic, lists.
- Undo/redo beyond the browser's native `contentEditable` undo stack.
- Persisting edited content to `localStorage` (existing app doesn't persist
  `generatedResume` either, so this is consistent with current behavior).
- Converting edited HTML back into Markdown syntax for the text export (plain
  text export was the explicit decision).
