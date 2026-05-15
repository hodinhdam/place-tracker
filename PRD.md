# Places You Love — Product Requirements Document

**Version:** 1.2
**Last updated:** 2026-05-15
**Owner:** Dam Ho
**Status:** Live (MVP shipped, iterating)

---

## Overview

Places You Love is a personal place-tracking app for Dam Ho and family to save, organize, and rediscover favorite spots across Vietnam. Places are captured via a Telegram bot (text, screenshot, or Maps link) and browsed via a web dashboard.

Internal codename: **VinaVault**.

---

## Goals

- Capture a place in under 10 seconds from Telegram (text, photo, or Maps link)
- Browse and filter saved places on a mobile-friendly web dashboard
- Track three lifecycle states: wishlist, visited, and favorite
- Keep it simple — no accounts, no social features, personal use only

---

## Stack

| Layer | Choice |
|---|---|
| Hosting | Vercel (serverless functions) |
| Database | Supabase (Postgres) |
| AI parsing | Claude Haiku (`claude-haiku-4-5-20251001`) — text + vision |
| Bot interface | Telegram Bot API (webhook mode) |
| Geocoding | OpenStreetMap Nominatim (reverse geocode from Maps URL) |
| Frontend | Vanilla HTML/JS + Tailwind CDN |
| Design system | Material Design 3 tokens, Be Vietnam Pro font (designed in Google Stitch via MCP) |

---

## Live URLs

- **Dashboard:** https://place-tracker-xi.vercel.app
- **GitHub:** https://github.com/hodinhdam/place-tracker
- **Telegram webhook:** `https://place-tracker-xi.vercel.app/api/telegram`

---

## Database Schema

**Table: `places`**

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Required |
| area | text | e.g. "Quận 1, TP.HCM" |
| address | text | Street address |
| type | text | `an_uong`, `ca_phe`, `du_lich`, `mua_sam`, `khac` |
| status | text | `wishlist` (default) or `visited` |
| notes | text | Tips, dishes, details |
| maps_url | text | Google Maps link |
| lat | float | Latitude |
| lng | float | Longitude |
| rating | int | 1–5 |
| tags | text[] | Free tags |
| is_favorite | bool | Default `false`; partial index on `TRUE` |
| added_by | text | Telegram user ID |
| created_at | timestamptz | Auto |

**Table: `trips`**

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Trip name |
| created_at | timestamptz | Auto |

---

## API Endpoints

### `GET /api/find`
Search and filter places.

| Param | Type | Description |
|---|---|---|
| q | string | Full-text search across name, area, notes |
| status | string | `wishlist` or `visited` |
| type | string | Place type |
| area | string | Area partial match |
| favorite | string | `true` to return only favorited places |

### `PATCH /api/find?id=<uuid>`
Update a place. Body examples:
- `{ "status": "visited" }`
- `{ "is_favorite": true }`

### `DELETE /api/find?id=<uuid>`
Delete a place by ID.

### `POST /api/save`
Save a place directly (no AI parsing).
Body: `{ name, area, type, notes, maps_url, status, address, lat, lng, rating, tags, added_by }`

### `POST /api/telegram`
Telegram webhook handler. Registered at `https://place-tracker-xi.vercel.app/api/telegram`.

---

## Telegram Bot — Input Modes

Three ways to add a place, all stateless (no pending-transaction table):

1. **Free-form text** — Claude Haiku parses Vietnamese text, extracts name/area/type/notes, saves as `wishlist`.
2. **Photo / screenshot** — Claude Vision reads the image (Instagram post, menu board, Google Maps screenshot) and extracts place info. Optional caption adds context. If no Maps URL is found, the bot auto-generates a Maps search link.
3. **Google Maps URL** — Bot resolves short links (`goo.gl`, `maps.app.goo.gl`) → extracts coordinates → reverse-geocodes via Nominatim to fill area + address.

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| (free text) | Claude AI parses Vietnamese text → saves as wishlist |
| (photo) | Claude Vision parses image → saves as wishlist |
| (Maps URL) | Resolves + geocodes → saves with lat/lng |
| `/find [query]` | Search saved places |
| `/wishlist` | List all wishlist places |
| `/visited` | Mark last saved place as visited |
| `/fav` | Mark last saved place as favorite |
| `/undo` | Delete last saved place |
| `/trips` | List all trips |
| `/addtrip [name]` | Create a new trip |

---

## Web Dashboard Features

Five views, accessible via desktop sidebar and mobile bottom nav:

- **Dashboard** — Stats overview (Total / Visited / Wishlist)
- **Places** — Full grid of all saved places
- **Wishlist** — Only `status = wishlist`
- **Visited** — Only `status = visited`
- **Favorites** — Only `is_favorite = true`

Inside each view:

- **Live search** across name, area, notes
- **Filter pills** — status, type, ❤️ Favorites
- **Place cards** — name, area, notes, type badge, status badge, Maps link
- **Card actions** — Mark Visited · Favorite (toggle) · Edit · Delete
- **Add / Edit modal** — Full form: name, area, type, status, notes, Maps URL
- **Mobile FAB** — Quick-add from any screen

---

## Place Types

| Value | Label | Emoji |
|---|---|---|
| `an_uong` | Ăn uống | 🍜 |
| `ca_phe` | Cà phê | ☕ |
| `du_lich` | Du lịch | 🌄 |
| `mua_sam` | Mua sắm | 🛍 |
| `khac` | Khác | 📌 |

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase REST URL (with `/rest/v1/` suffix) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude (text + vision) |
| `TELEGRAM_TOKEN` | Telegram bot token |

---

## Development Workflow

```
PRD → Stitch (UI design) → Claude Code (implement) → vercel deploy --prod
```

New features start with a PRD update, UI screens designed in Google Stitch via MCP, then implemented in Claude Code and deployed to Vercel.

---

## Known Limitations

- Search is case-insensitive but **not** accent-insensitive (searching "com tam" won't match "Cơm Tấm")
- No authentication — dashboard is public (personal use, obscurity by URL)
- Telegram `/visited`, `/fav`, and `/undo` target the last saved place globally per user ID, not per session

---

## Backlog

- [ ] Accent-insensitive search via Postgres `unaccent` extension
- [ ] Image upload per place
- [ ] Assign places to a trip from the dashboard
- [ ] Map view with clustered pins by area
- [ ] Share a place card as an image
