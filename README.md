# Places You Love

A personal place-tracking app for saving and rediscovering favorite spots in Vietnam. Add places instantly via Telegram, browse them on a web dashboard.

**Live:** https://place-tracker-xi.vercel.app
**GitHub:** https://github.com/hodinhdam/place-tracker

---

## Development Workflow

```
PRD → Stitch (UI design) → Claude Code (implement) → vercel deploy --prod
```

New features start with a PRD, UI screens designed in Google Stitch via MCP, then implemented and deployed to Vercel.

---

## Features

- **Telegram bot** — capture a place in under 10 seconds: free-form Vietnamese text, screenshot, or Google Maps link
- **AI parsing** — Claude Haiku extracts name, area, type, and notes automatically
- **Web dashboard** — search, filter by status / type / favorite, mark visited, favorite, edit, delete
- **Wishlist → Visited** — track what's been explored
- **Favorites** — mark standout places, filter to just the keepers
- **Trip collections** — create trips via Telegram (assignment from UI is in the backlog)

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| Any free text | Claude Haiku parses Vietnamese text → extracts name, area, type, notes → saves |
| Photo / screenshot | Claude Vision reads the image → extracts place info → saves. Optional caption for extra context |
| Google Maps URL | Bot resolves URL → extracts coordinates → reverse geocodes via OpenStreetMap → saves with lat/lng |
| `/find [query]` | Search saved places by name, area, or notes |
| `/wishlist` | List all wishlist places |
| `/visited` | Mark last saved place as visited |
| `/fav` | Mark last saved place as favorite |
| `/undo` | Delete last saved place |
| `/trips` | List all trips |
| `/addtrip [name]` | Create a new trip |

### How AI parsing works

**Text input:**
1. Send: *"Bún bò Huế 44 Đinh Tiên Hoàng quận 1, ngon, ~80k"*
2. Claude Haiku extracts: name, area, type, notes
3. Saves to Supabase → appears on dashboard instantly

**Screenshot / photo:**
1. Send any screenshot (Instagram, Google Maps, menu board, etc.)
2. Claude Vision reads the image and extracts place info
3. Add a caption for extra context (e.g. *"quán này ngon lắm"*)
4. Bot auto-generates a Google Maps search link if no URL is found

**Google Maps URL:**
1. Paste any Maps link (`goo.gl`, `maps.app.goo.gl`, `maps.google.com`)
2. Bot resolves the short URL → extracts place name + coordinates
3. Reverse geocodes via OpenStreetMap → fills area + address automatically
4. Saves with exact lat/lng for future map view

---

## Web Dashboard

Five views, accessible via desktop sidebar and mobile bottom nav:

- **Dashboard** — stats overview (Total / Visited / Wishlist)
- **Places** — full grid with all places
- **Wishlist** — only `status = wishlist`
- **Visited** — only `status = visited`
- **Favorites** — only `is_favorite = true`

Inside each view:

- **Live search** across name, area, notes
- **Filter pills** — status, type, ❤️ Favorites
- **Place cards** — name, area, notes, type badge, status badge, Maps link
- **Card actions** — Mark Visited · Favorite (toggle) · Edit · Delete
- **Add / Edit modal** — full form: name, area, type, status, notes, Maps URL
- **Mobile FAB** — quick-add from any screen

---

## Place Types

| Type | Label |
|---|---|
| `an_uong` | Ăn uống 🍜 |
| `ca_phe` | Cà phê ☕ |
| `du_lich` | Du lịch 🌄 |
| `mua_sam` | Mua sắm 🛍 |
| `khac` | Khác 📌 |

---

## Stack

| Layer | Tech |
|---|---|
| Hosting | Vercel (serverless Node.js) |
| Database | Supabase (Postgres) |
| AI parsing | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Bot | Telegram Bot API (webhook) |
| Frontend | Vanilla HTML/JS + Tailwind CDN |
| Design | Google Stitch via MCP, Material Design 3 tokens, Be Vietnam Pro |

---

## Project Structure

```
api/
  telegram.js  — POST /api/telegram (webhook handler, entry point)
  save.js      — POST /api/save (save place, no AI) + parsing helpers
  find.js      — GET /api/find (search), PATCH/DELETE /api/find?id= (update/delete)
public/
  index.html   — Web dashboard (single-file vanilla app)
```

---

## Database Schema

**Table: `places`**

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Required |
| area | text | e.g. "Quận 1, TP.HCM" |
| address | text | Street address |
| type | text | `an_uong` / `ca_phe` / `du_lich` / `mua_sam` / `khac` |
| status | text | `wishlist` (default) or `visited` |
| notes | text | Tips, dishes, details |
| maps_url | text | Google Maps link |
| lat / lng | float | Coordinates |
| rating | int | 1–5 |
| tags | text[] | Free tags |
| is_favorite | bool | Default `false`; partial index on `TRUE` |
| added_by | text | Telegram user ID |
| created_at | timestamptz | Auto |

**Table: `trips`**

| Column | Type |
|---|---|
| id | uuid |
| name | text |
| created_at | timestamptz |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/find` | Search / filter. Query params: `q`, `status`, `type`, `area`, `favorite` (=`true`) |
| `PATCH` | `/api/find?id=<uuid>` | Update place. Body example: `{ "status": "visited" }`, `{ "is_favorite": true }` |
| `DELETE` | `/api/find?id=<uuid>` | Delete place |
| `POST` | `/api/save` | Save place directly (no AI). Body: name (required), area, type, notes, maps_url, status, address, lat, lng, rating, tags, added_by |
| `POST` | `/api/telegram` | Telegram webhook (registered once) |

---

## Local Setup

```bash
git clone https://github.com/hodinhdam/place-tracker.git
cd place-tracker
npm install
```

Create `.env`:

```
SUPABASE_URL=https://your-project.supabase.co/rest/v1/
SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_TOKEN=your-bot-token
```

---

## Deploy

```bash
vercel deploy --prod
```

Register Telegram webhook after deploy:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram"
```

---

## Known Limitations

- Search is case-insensitive but **not** accent-insensitive ("com tam" ≠ "Cơm Tấm")
- No auth — dashboard public by obscurity (personal use only)
- `/visited`, `/fav`, and `/undo` target the last saved place per Telegram user ID (global, not per-session)

## Backlog

- [ ] Accent-insensitive search via Postgres `unaccent`
- [ ] Image upload per place
- [ ] Assign places to a trip from the dashboard
- [ ] Map view with clustered pins by area
- [ ] Share a place card as image
