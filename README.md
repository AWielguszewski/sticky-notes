# Sticky Notes

![The board](screenshot.png)

An endless board where sticky notes are created, moved, resized, tagged, given pictures and thrown
away with the mouse — or with a finger, on a phone. A tag carries a colour, and it paints every
note that carries it. Light and dark, whichever you pick.

## Stack

TypeScript · React 19 · Vite 8 · CSS Modules, with the notes kept in SQLite behind a Node server
that has no dependencies of its own. No UI, state or drag-and-drop libraries.

## Running it

```bash
docker compose up -d      # http://127.0.0.1:8787, back up whenever docker is
```

The board lives in `./data`, mounted into the container, so a restart costs nothing.

## Working on it

```bash
npm install
npm run server            # api on 8787
npm run dev               # client on 5173, proxying /api
npm test
```

The board is also reachable over an MCP connection: the server in `mcp/` exposes it as tools for
reading notes and writing them back. A note is read whole — `read_note` answers with the pictures
attached to it as pictures, not as links to go and fetch.
