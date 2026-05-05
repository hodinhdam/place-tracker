# VinaVault — Product Requirements Document

**Version:** 1.1  
**Last updated:** 2026-05-05  
**Owner:** Dam Ho  
**Status:** Live (MVP shipped)

---

## Overview

VinaVault is a personal place-tracking app for Dam Ho and family to save, organize, and rediscover favorite spots across Vietnam. Places are added via a Telegram bot (quick capture on mobile) and browsed via a web dashboard.

---

## Goals

- Capture a place in under 10 seconds from Telegram (text or Maps link)
- Browse and filter saved places on a mobile-friendly web dashboard
- Track wishlist vs. visited status
- Keep it simple — no accounts, no social features, personal use only

---

## Stack

| Layer | Choice |
|---|---|
| Hosting | Vercel (serverless functions) |
| Database | Supabase (Postgres) |
| AI parsing | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Bot interface | Telegram Bot API (webhook mode) |
| Frontend | Vanilla HTML/JS + Tailwind CDN |
| Design system | VinaVault (Material Design 3 tokens, Be Vietnam Pro font) |

---

## Live URLs

- **Dashboard:** https://place-tracker-xi.vercel.app
- **GitHub:** https://github.com/hodinhdam/place-tracker

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

### `PATCH /api/find?id=<uuid>`
Update a place (e.g. mark as visited).  
Body: `{ "status": "visited" }`

### `DELETE /api/find?id=<uuid>`
Delete a place by ID.

### `POST /api/save`
Save a place directly (no AI parsing).  
Body: `{ name, area, type, notes, maps_url, status, address, lat, lng, rating, tags, added_by }`

### `POST /api/telegram`
Telegram webhook handler. Registered at `https://place-tracker-xi.vercel.app/api/telegram`.

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| (free text) | Claude AI parses Vietnamese text → saves as wishlist place |
| (Maps URL) | Saves directly with the Maps link |
| `/find [query]` | Search saved places |
| `/wishlist` | List all wishlist places |
| `/visited` | Mark last saved place as visited |
| `/undo` | Delete last saved place |
| `/trips` | List all trips |
| `/addtrip [name]` | Create a new trip |

---

## Web Dashboard Features

- **Stats bar** — Total / Visited / Wishlist counts
- **Search** — Live search across name, area, notes
- **Filter pills** — By status (All / Wishlist / Visited) and type
- **Place cards** — Name, area, notes, type badge, status badge, Maps link
- **Mark Visited button** — One tap updates status (wishlist cards only)
- **Delete button** — Confirmation prompt then removes place
- **Add Place modal** — Form with name, area, type, notes, Maps URL, status
- **Desktop sidebar nav** — Dashboard / Explore / Wishlist / Visited
- **Mobile bottom nav** — Home / Explore / Wishlist / Visited + FAB

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
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `TELEGRAM_TOKEN` | Telegram bot token |

---

## Known Limitations

- Search is case-insensitive but **not** accent-insensitive (searching "com tam" won't match "Cơm Tấm")
- No authentication — dashboard is public (personal use, obscurity by URL)
- Telegram `/visited` and `/undo` target the last saved place globally per user ID, not per session

---

## Potential Next Steps

- Accent-insensitive search via Postgres `unaccent` extension
- Image upload per place
- Trip collections (assign places to a trip)
- Map view (cluster pins by area)
- Share a place card as an image
