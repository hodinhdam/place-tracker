# VinaVault

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

- **Telegram bot** — capture a place in under 10 seconds, free-form Vietnamese text or Google Maps link
- **AI parsing** — Claude Haiku extracts name, area, type, and notes automatically
- **Web dashboard** — search, filter by type and status, mark visited, delete, add manually
- **Trip collections** — group places into trips
- **Wishlist → Visited** — track what's been explored

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| Any free text | Claude Haiku parses Vietnamese text → extracts name, area, type, notes → saves |
| Photo / screenshot | Claude Vision reads the image → extracts place info → saves. Add a caption for extra context |
| Google Maps URL | Bot resolves URL → extracts coordinates → reverse geocodes via OpenStreetMap → saves with lat/lng |
| `/find [query]` | Search saved places by name, area, or notes |
| `/wishlist` | List all wishlist places |
| `/visited` | Mark last saved place as visited |
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
4. Bot auto-generates a Google Maps search link if no URL found

**Google Maps URL:**
1. Paste any Maps link (goo.gl, maps.app.goo.gl, maps.google.com)
2. Bot resolves the short URL → extracts place name + coordinates
3. Reverse geocodes via OpenStreetMap → fills area + address automatically
4. Saves with exact lat/lng for future map view

---

## Web Dashboard

- Stats bar — Total / Visited / Wishlist counts
- Live search across name, area, notes
- Filter by status (All / Wishlist / Visited) and place type
- Place cards with Maps link, type badge, status badge
- Mark Visited — one tap updates status
- Add Place modal — manual entry with all fields
- Mobile bottom nav + desktop sidebar

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
| Design | Google Stitch via MCP |

---

## Project Structure

```
api/
  telegram.js  — POST /api/telegram (webhook handler, entry point)
  save.js      — POST /api/save (save place, no AI)
  find.js      — GET /api/find (search + filter), PATCH/DELETE /api/find?id=
public/
  index.html   — Web dashboard
```

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

- Search is case-insensitive but not accent-insensitive ("com tam" ≠ "Cơm Tấm")
- No auth — dashboard public by obscurity (personal use)
- `/visited` and `/undo` target last saved place per Telegram user ID

## Backlog

- [ ] Accent-insensitive search via Postgres `unaccent`
- [ ] Image upload per place
- [ ] Assign places to a trip
- [ ] Map view with clustered pins
- [ ] Share a place card as image
