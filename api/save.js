'use strict';
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  (process.env.SUPABASE_URL || '').replace('/rest/v1/', ''),
  process.env.SUPABASE_ANON_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompt is stable — cache_control marks it for reuse across requests.
// Haiku 4.5 requires 4096+ tokens to cache; this prompt is shorter but the
// marker is intentional so caching kicks in automatically if the prompt grows.
const PARSE_SYSTEM =
  'You are a Vietnamese place description parser. ' +
  'Extract place information from the input and return ONLY a valid JSON object. ' +
  'Fields: name (string, required — the place name), ' +
  'area (string — district and city, e.g. "Quan 1, TP.HCM"), ' +
  'type (string — one of: an_uong, ca_phe, du_lich, mua_sam, khac), ' +
  'notes (string — tips, dish names, or details), ' +
  'address (string or null — street address if mentioned). ' +
  'Return raw JSON only, no markdown fences, no explanation.';

async function parsePlaceFromText(text) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: PARSE_SYSTEM,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: text }]
  });
  const raw = message.content[0].text
    .trim()
    .replace(/^```json?\n?/, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(raw);
}

async function savePlace(placeData) {
  const { data, error } = await supabase
    .from('places')
    .insert([placeData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function parseAndSavePlace(text, userId) {
  const parsed = await parsePlaceFromText(text);
  return savePlace(Object.assign({}, parsed, { status: 'wishlist', added_by: userId }));
}

// POST /api/save — save a place directly (no AI parsing)
const handler = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { name, area, type, address, maps_url, lat, lng, notes, status, rating, tags, added_by } = body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const { data, error } = await supabase
    .from('places')
    .insert([{
      name,
      area: area || null,
      type: type || null,
      address: address || null,
      maps_url: maps_url || null,
      lat: lat || null,
      lng: lng || null,
      notes: notes || null,
      status: status || 'wishlist',
      rating: rating || null,
      tags: tags || null,
      added_by: added_by || null
    }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, place: data });
};

handler.parsePlaceFromText = parsePlaceFromText;
handler.savePlace = savePlace;
handler.parseAndSavePlace = parseAndSavePlace;

module.exports = handler;
