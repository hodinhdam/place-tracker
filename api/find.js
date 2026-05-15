'use strict';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  (process.env.SUPABASE_URL || '').replace('/rest/v1/', ''),
  process.env.SUPABASE_ANON_KEY
);

async function findPlaces(query, filters) {
  var q = supabase
    .from('places')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  if (filters && filters.area) q = q.ilike('area', '%' + filters.area + '%');
  if (filters && filters.type) q = q.eq('type', filters.type);
  if (filters && filters.status) q = q.eq('status', filters.status);
  if (query) q = q.or('name.ilike.%' + query + '%,notes.ilike.%' + query + '%,area.ilike.%' + query + '%');
  var result = await q;
  if (result.error) throw result.error;
  return result.data || [];
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

  var area = req.query.area;
  var type = req.query.type;
  var status = req.query.status;
  var q = req.query.q;

  var dbQuery = supabase
    .from('places')
    .select('*')
    .order('created_at', { ascending: false });

  if (area) dbQuery = dbQuery.ilike('area', '%' + area + '%');
  if (type) dbQuery = dbQuery.eq('type', type);
  if (status) dbQuery = dbQuery.eq('status', status);
  if (req.query.favorite === 'true') dbQuery = dbQuery.eq('is_favorite', true);
  if (q) dbQuery = dbQuery.or('name.ilike.%' + q + '%,notes.ilike.%' + q + '%,area.ilike.%' + q + '%');

  var result = await dbQuery;

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
