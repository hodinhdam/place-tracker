'use strict';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  (process.env.SUPABASE_URL || '').replace('/rest/v1/', ''),
  process.env.SUPABASE_ANON_KEY
);

async function findPlaces(query, filters) {
  var result = await supabase.rpc('search_places', {
    p_q: query || null,
    p_area: (filters && filters.area) || null,
    p_type: (filters && filters.type) || null,
    p_status: (filters && filters.status) || null,
    p_favorite: null
  });
  if (result.error) throw result.error;
  return (result.data || []).slice(0, 10);
}

async function getWishlist() {
  var result = await supabase
    .from('places')
    .select('*')
    .eq('status', 'wishlist')
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return result.data || [];
}

async function getLastSaved(userId) {
  var result = await supabase
    .from('places')
    .select('*')
    .eq('added_by', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (result.error) throw result.error;
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

async function markVisited(placeId) {
  var result = await supabase
    .from('places')
    .update({ status: 'visited' })
    .eq('id', placeId)
    .select()
    .single();
  if (result.error) throw result.error;
  return result.data;
}

async function markFavorite(placeId) {
  var result = await supabase
    .from('places')
    .update({ is_favorite: true })
    .eq('id', placeId)
    .select()
    .single();
  if (result.error) throw result.error;
  return result.data;
}

async function deletePlace(placeId) {
  var result = await supabase.from('places').delete().eq('id', placeId);
  if (result.error) throw result.error;
}

// GET /api/find   — search/filter places
// PATCH /api/find?id=X — update a place (e.g. mark visited)
// DELETE /api/find?id=X — delete a place
var handler = async function handler(req, res) {
  var id = req.query.id;

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    var delResult = await supabase.from('places').delete().eq('id', id);
    if (delResult.error) return res.status(500).json({ error: delResult.error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    var body = req.body || {};
    var patchResult = await supabase
      .from('places')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (patchResult.error) return res.status(500).json({ error: patchResult.error.message });
    return res.status(200).json({ place: patchResult.data });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var result = await supabase.rpc('search_places', {
    p_q: req.query.q || null,
    p_area: req.query.area || null,
    p_type: req.query.type || null,
    p_status: req.query.status || null,
    p_favorite: req.query.favorite === 'true' ? true : null
  });

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  return res.status(200).json({ places: result.data || [] });
};

handler.findPlaces = findPlaces;
handler.getWishlist = getWishlist;
handler.getLastSaved = getLastSaved;
handler.markVisited = markVisited;
handler.markFavorite = markFavorite;
handler.deletePlace = deletePlace;

module.exports = handler;
