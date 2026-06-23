# FORCAST-KIT UI — Agent Guide

Local browser explorer at `http://127.0.0.1:3848`. Styled like applied.dev (Roboto Mono, OKLCH tokens, lean cards, detail sheet).

## Dev

```bash
bun run serve          # API on :3847 only
bun run ui             # API + UI (:3847 + :3848)
bun run ui:app         # UI only (if API already running)
```

Set `NEXT_PUBLIC_FORCAST_KIT_API_URL` only if bypassing the built-in `/api` proxy (direct cross-origin calls need CORS on the API).

## Patterns

- **Lean cards** on `/markets` and `/events`; full detail in `MarketDetailSheet` (fetches `/markets/:ticker` + `/export`).
- **Event comparison** at `/events/[eventTicker]` with CSS implied-% bars.
- **Edits** via admin API routes; sync dialog warns when sheet has unsaved edits.
- Theme persisted in `localStorage` (`forcast-kit-theme`).
- Static UI headings, buttons, form labels, and filter triggers use **Title Case** (see `.cursor/rules/ui-title-case.mdc`).

## Stack

Next.js 15, React 19, Tailwind 4, Sonner. HTTP client only — no direct DB access.
