'use strict';
const { createClient } = require('@supabase/supabase-js');
const { parseAndSavePlace } = require('./save');
const { findPlaces, getWishlist, getLastSaved, markVisited, deletePlace } = require('./find');

const supabase = createClient(
  (process.env.SUPABASE_URL || '').replace('/rest/v1/', ''),
  process.env.SUPABASE_ANON_KEY
);

const MAPS_PATTERN = /https?:\/\/(maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S*/i;

const TYPE_LABELS = {
  an_uong: 'An uong',
  ca_phe: 'Ca phe',
  du_lich: 'Du lich',
  mua_sam: 'Mua sam',
  khac: 'Khac'
};

async function sendMessage(chatId, text, parseMode) {
  var url = 'https://api.telegram.org/bot' + process.env.TELEGRAM_TOKEN + '/sendMessage';
  var body = { chat_id: chatId, text: text };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function formatPlace(place) {
  var status = place.status === 'visited' ? '[done]' : '[wish]';
  var type = TYPE_LABELS[place.type] || place.type || '';
  var line1 = status + ' *' + place.name + '*';
  var meta = (place.area || '') + (place.area && type ? ' — ' : '') + type;
  var text = meta ? line1 + '\n' + meta : line1;
  if (place.notes) text = text + '\n' + place.notes;
  if (place.maps_url) text = text + '\n' + place.maps_url;
  return text;
}

function formatList(places) {
  if (!places || places.length === 0) return 'No places found.';
  return places.map(function(p, i) {
    return (i + 1) + '. ' + formatPlace(p);
  }).join('\n\n');
}

// POST /api/telegram — Telegram webhook
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var update = req.body;
  if (!update || !update.message || !update.message.text) {
    return res.status(200).json({ ok: true });
  }

  var msg = update.message;
  var chatId = msg.chat.id;
  var text = msg.text.trim();
  var userId = String(msg.from.id);

  try {

    // /find [query] — search places
    if (/^\/find(\s|$)/.test(text)) {
      var query = text.replace(/^\/find\s*/, '').trim();
      var places = await findPlaces(query, {});
      await sendMessage(chatId, formatList(places), 'Markdown');

    // /wishlist — show all wishlist items
    } else if (text === '/wishlist') {
      var wishlist = await getWishlist();
      await sendMessage(chatId, formatList(wishlist), 'Markdown');

    // /visited — mark last saved place as visited
    } else if (text === '/visited') {
      var last = await getLastSaved(userId);
      if (!last) {
        await sendMessage(chatId, 'No recently saved place found.');
      } else {
        await markVisited(last.id);
        await sendMessage(chatId, 'Marked *' + last.name + '* as visited ✓', 'Markdown');
      }

    // /undo — delete last saved place
    } else if (text === '/undo') {
      var toDelete = await getLastSaved(userId);
      if (!toDelete) {
        await sendMessage(chatId, 'Nothing to undo.');
      } else {
        await deletePlace(toDelete.id);
        await sendMessage(chatId, 'Deleted: ' + toDelete.name);
      }

    // /trips — list all trips
    } else if (text === '/trips') {
      var tripsResult = await supabase
        .from('trips')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });
      if (tripsResult.error || !tripsResult.data || tripsResult.data.length === 0) {
        await sendMessage(chatId, 'No trips yet. Use /addtrip [name] to create one.');
      } else {
        var tripLines = tripsResult.data.map(function(t, i) {
          return (i + 1) + '. ' + t.name + ' (id: ' + t.id + ')';
        });
        await sendMessage(chatId, 'Trips:\n' + tripLines.join('\n'));
      }

    // /addtrip [name] — create a new trip
    } else if (/^\/addtrip(\s|$)/.test(text)) {
      var tripName = text.replace(/^\/addtrip\s*/, '').trim();
      if (!tripName) {
        await sendMessage(chatId, 'Usage: /addtrip [name]');
      } else {
        var addResult = await supabase
          .from('trips')
          .insert([{ name: tripName }])
          .select()
          .single();
        if (addResult.error) {
          await sendMessage(chatId, 'Error creating trip: ' + addResult.error.message);
        } else {
          await sendMessage(chatId, 'Trip created: ' + addResult.data.name);
        }
      }

    // Free text — AI parse and save
    } else if (!text.startsWith('/')) {
      var mapsMatch = text.match(MAPS_PATTERN);

      if (mapsMatch) {
        var mapsInsert = await supabase
          .from('places')
          .insert([{
            name: 'Place from Maps',
            maps_url: mapsMatch[0],
            type: 'khac',
            status: 'wishlist',
            added_by: userId
          }])
          .select()
          .single();
        if (mapsInsert.error) {
          await sendMessage(chatId, 'Error saving: ' + mapsInsert.error.message);
        } else {
          await sendMessage(chatId, 'Saved from Maps link!\n' + formatPlace(mapsInsert.data), 'Markdown');
        }

      } else {
        await sendMessage(chatId, 'Saving...');
        var saved = await parseAndSavePlace(text, userId);
        await sendMessage(
          chatId,
          'Saved!\n' + formatPlace(saved) + '\n\nReply /visited to mark done, /undo to delete.',
          'Markdown'
        );
      }
    }

  } catch (err) {
    await sendMessage(chatId, 'Error: ' + err.message);
  }

  return res.status(200).json({ ok: true });
};
