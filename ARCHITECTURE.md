# Architecture

Implemented: creating a note of a chosen size at a chosen position (drawing a rectangle on the
board, or double-clicking for a default size), moving it by dragging, resizing it by its corner,
and deleting it by dropping it on the trash zone. Optional features: editing note text, raising a
note above overlapping ones, five note colors, and persistence through an asynchronous mock REST
API backed by local storage.

The code is layered and each layer only knows the one below it. `src/model` is the pure domain:
rectangle math plus the `Note` shape, whose `NoteId` is a branded string so it cannot be confused
with any other id. `src/api` stands in for a REST backend — it exposes `list`, `save` and `remove`,
adds latency, serializes its requests so that concurrent read-modify-write calls cannot drop each
other's changes, and decodes what it reads out of local storage instead of trusting `JSON.parse`.
`src/state` owns the application state, `src/hooks` the pointer-gesture primitive, `src/components`
the UI; nothing below the components knows that React exists.

State is a single reducer keyed by note id, mutated through an exhaustively typed union of actions,
and exposed through three separate contexts — state, actions and sync status — so a component only
re-renders for the slice it reads. The action object is created once, which keeps memoized note
cards valid, and stacking is expressed as a `z-index` rather than as DOM order, so raising a note
neither re-mounts it nor reorders the tree. Every mutation is applied locally first and then handed
to a write-behind syncer that coalesces per note id: a burst of keystrokes or a finished drag ends
up as one request, and the toolbar reports what the syncer is doing.

Dragging is the performance-critical path, so it deliberately runs outside React. `usePointerDrag`
turns a press into a captured gesture — pointer capture, at most one callback per animation frame,
Escape to cancel — and gives the caller a context captured at press time, which keeps the gesture
immune to re-renders while it runs. During the gesture the note writes its own position, size and
state flags straight to its DOM node, the trash bounds are measured once instead of every frame,
and the trash zone and the draft outline are driven through imperative handles. Only on release
does a single action reach the reducer, so a drag lasting hundreds of frames costs one render.
