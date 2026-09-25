# Sticky Notes

A single-page board where sticky notes are created, moved, resized, edited and thrown away with the mouse.

## Stack

TypeScript · React 19 · Vite 8 · CSS Modules. No UI, state or drag-and-drop libraries.

## Getting started

```bash
npm install
npm run dev
```

The dev server prints a local URL, by default http://localhost:5173.

```bash
npm run build     # type-check, then bundle into dist/
npm run preview   # serve the production build
```

## What it does

- Drag on an empty part of the board to draw a note, or double-click for a default-sized one.
- Drag a note to move it, drag its bottom-right corner to resize it, drop it on the bin (or select it and press Delete) to remove it.
- Click a note to edit its text; the note you touch comes to the front.
- Five colors, and everything is saved through a mock REST API that keeps data in local storage.

## How it is built

- `src/model` is plain TypeScript: rectangle math and the `Note` type, no React.
- `src/api/notesApi.ts` pretends to be a backend: every call is async with 40–180 ms of random latency.
- Those calls go through a promise queue, because each one reads the whole list and writes it back, and two overlapping calls would otherwise lose one of the changes.
- `src/api/notesStorage.ts` validates what comes out of local storage instead of trusting `JSON.parse`, so a broken entry is skipped rather than crashing the app.
- State lives in one `useReducer`, split into three contexts (notes, actions, save status) so a component only re-renders for what it reads.
- Changes are applied locally first and then saved by `noteSyncer`, which waits 250 ms per note, so typing or a finished drag ends up as one request.
- Pending saves are flushed on `pagehide`, so closing the tab right after an edit does not lose it.
- Stacking is a `z` number on the note, so bringing a note forward does not reorder or remount anything.

## Dragging

- Dragging is the one hot path, so it runs outside React: `usePointerDrag` captures the pointer and calls back on every `pointermove`.
- During a gesture the note writes its position and size straight to its own DOM node, and the reducer gets a single update on release.
- There is no extra throttling, because browsers already deliver `pointermove` about once per frame.
- The bin is measured once when a drag starts, not on every move, and Escape cancels the gesture and puts the note back.
