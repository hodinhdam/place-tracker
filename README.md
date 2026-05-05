# VinaVault

A personal place-tracking app for saving and rediscovering favorite spots in Vietnam. Add places instantly via Telegram, browse them on a web dashboard.

**Live:** https://place-tracker-xi.vercel.app

---

## Features

- **Telegram bot** — send any text description and Claude AI parses and saves it. Paste a Google Maps link and it saves instantly.
- **Web dashboard** — search, filter by type and status, mark visited, delete.
- **AI parsing** — Claude Haiku extracts name, area, type, and notes from free-form Vietnamese text.

## Telegram Commands

| Command | Description |
|---|---|
| Any text | AI parses and saves as a wishlist place |
| Google Maps URL | Saves with the Maps link attached |
| `/find [query]` | Search your saved places |
| `/wishlist` | Show all wishlist places |
| `/visited` | Mark your last saved place as visited |
| `/undo` | Delete your last saved place |
| `/trips` | List all trips |
| `/addtrip [name]` | Create a new trip |

## Stack

- **Vercel** — serverless Node.js functions
- **Supabase** — Postgres database
- **Anthropic Claude Haiku** — AI text parsing
- **Telegram Bot API** — webhook-based bot
- **Tailwind CSS** — frontend styling

## Local Setup

```bash
git clone https://github.com/hodinhdam/place-tracker.git
cd place-tracker
npm install
```

Create a `.env` file:

```
SUPABASE_URL=https://your-project.supabase.co/rest/v1/
SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_TOKEN=your-bot-token
```

## Deploy

```bash
npx vercel --prod
```

Register the Telegram webhook after deploying:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram"
```

## Project Structure

```
api/
  find.js      — GET /api/find (search), PATCH/DELETE /api/find?id=
  save.js      — POST /api/save + Claude parsing logic
  telegram.js  — POST /api/telegram (webhook handler)
public/
  index.html   — Web dashboard
```
