'use strict';
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_BASE = (process.env.SUPABASE_URL || '').replace('/rest/v1/', '');
const supabase = createClient(SUPABASE_BASE, process.env.SUPABASE_ANON_KEY);

// Storage writes use the service_role key (server-only) so the bucket can stay
// locked to anon. Falls back to the anon client if the key isn't set.
const IMAGE_BUCKET = 'place-images';
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_BASE, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : supabase;

// Upload a place photo to Storage and return its public URL. Non-fatal: returns
// null on any failure so the place still saves without an image.
async function uploadPlaceImage(buffer, mediaType) {
  try {
    const ext = mediaType === 'image/png' ? 'png' : 'jpg';
    const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const { error } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(path, buffer, { contentType: mediaType, upsert: false });
    if (error) return null;
    const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data ? data.publicUrl : null;
  } catch {
    return null;
  }
}
// timeout/maxRetries guard: SDK default is 10min + 2 retries with backoff, which
// can blow past the function's maxDuration and get the whole webhook killed
// (no response → Telegram retries → duplicate saves). Cap it so a slow Haiku
// call aborts gracefully and falls back to URL-derived name.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 8000,
  maxRetries: 1
});

// System prompt is stable — cache_control marks it for reuse across requests.
// Haiku 4.5 requires 4096+ tokens to cache; this prompt is shorter but the
// marker is intentional so caching kicks in automatically if the prompt grows.
const PARSE_SYSTEM =
  'You are a Vietnamese place description parser. ' +
  'Extract place information from the input and call the save_place tool with it. ' +
  'name is the place name; area is district and city, e.g. "Quan 1, TP.HCM"; ' +
  'notes are tips, dish names, or details; address is the street address if mentioned.';

// Forced tool use instead of "return raw JSON": the model sometimes wrapped the
// JSON in prose or extra text, and JSON.parse on that threw "not valid JSON"
// back to the user. A forced tool call always yields a parsed object.
const PLACE_TOOL = {
  name: 'save_place',
  description: 'Save the extracted place.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Place name' },
      area: { type: 'string', description: 'District and city' },
      type: { type: 'string', enum: ['an_uong', 'ca_phe', 'du_lich', 'mua_sam', 'khac'] },
      notes: { type: 'string', description: 'Tips, dish names, or details' },
      address: { type: ['string', 'null'], description: 'Street address if mentioned' }
    },
    required: ['name']
  }
};

const PLACE_FIELDS = ['name', 'area', 'type', 'notes', 'address'];

async function callParser(content) {
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
    tools: [PLACE_TOOL],
    tool_choice: { type: 'tool', name: PLACE_TOOL.name },
    messages: [{ role: 'user', content }]
  });
  const block = message.content.find(function(b) { return b.type === 'tool_use'; });
  if (!block || !block.input) throw new Error('Parser returned no place data');
  // Only keep known columns so a stray field can't break the Supabase insert.
  const parsed = {};
  PLACE_FIELDS.forEach(function(f) {
    if (block.input[f] !== undefined && block.input[f] !== '') parsed[f] = block.input[f];
  });
  return parsed;
}

async function parsePlaceFromText(text) {
  return callParser(text);
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

async function resolveMapsUrl(url) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    clearTimeout(t);
    return response.url;
  } catch {
    return url;
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
      { headers: { 'User-Agent': 'vinavault-bot/1.0' }, signal: controller.signal }
    );
    clearTimeout(t);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function parsePlaceFromMapsUrl(mapsUrl, extraText) {
  const fullUrl = await resolveMapsUrl(mapsUrl);

  const placeMatch = fullUrl.match(/\/maps\/place\/([^/@?]+)/);
  const coordMatch = fullUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const urlName = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : null;
  const lat = coordMatch ? parseFloat(coordMatch[1]) : null;
  const lng = coordMatch ? parseFloat(coordMatch[2]) : null;

  let geoArea = null;
  let geoAddress = null;
  if (lat && lng) {
    const geo = await reverseGeocode(lat, lng);
    if (geo && geo.address) {
      const a = geo.address;
      const street = [a.house_number, a.road].filter(Boolean).join(' ');
      const district = a.quarter || a.suburb || a.city_district || a.county || '';
      const city = a.city || a.town || a.village || '';
      if (street) geoAddress = street;
      if (district || city) geoArea = [district, city].filter(Boolean).join(', ');
    }
  }

  const parts = [];
  if (extraText) parts.push(extraText);
  if (urlName) parts.push('Tên: ' + urlName);
  if (geoAddress) parts.push('Địa chỉ: ' + geoAddress);
  if (geoArea) parts.push('Khu vực: ' + geoArea);

  let parsed = {};
  if (parts.length > 0) {
    try {
      parsed = await parsePlaceFromText(parts.join('\n'));
    } catch {
      parsed = {};
    }
  }

  if (!parsed.name && urlName) parsed.name = urlName;
  if (!parsed.name) parsed.name = 'Place from Maps';
  if (!parsed.area && geoArea) parsed.area = geoArea;
  if (!parsed.address && geoAddress) parsed.address = geoAddress;
  if (lat) parsed.lat = lat;
  if (lng) parsed.lng = lng;

  return parsed;
}

async function parsePlaceFromImage(imageBase64, mediaType, caption) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    { type: 'text', text: caption || 'Extract place information from this screenshot.' }
  ];
  try {
    return await callParser(content);
  } catch (err) {
    // Non-fatal: telegram.js falls back to a default name + Maps search link.
    console.error('parsePlaceFromImage failed:', err);
    return {};
  }
}

async function parseAndSavePlace(text, userId) {
  let parsed;
  try {
    parsed = await parsePlaceFromText(text);
  } catch (err) {
    // Don't lose the message if the parser fails — save the raw text so it can
    // be edited on the dashboard later.
    console.error('parsePlaceFromText failed:', err);
    parsed = {};
  }
  if (!parsed.name) {
    parsed.name = text.split('\n')[0].slice(0, 100);
    if (!parsed.notes && text.length > parsed.name.length) parsed.notes = text;
  }
  return savePlace(Object.assign({}, parsed, { status: 'wishlist', added_by: userId }));
}

// POST /api/save — save a place directly (no AI parsing)
const handler = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { name, area, type, address, maps_url, lat, lng, notes, status, rating, tags, added_by, image_url } = body;

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
      added_by: added_by || null,
      image_url: image_url || null
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
handler.parsePlaceFromMapsUrl = parsePlaceFromMapsUrl;
handler.parsePlaceFromImage = parsePlaceFromImage;
handler.uploadPlaceImage = uploadPlaceImage;

module.exports = handler;
