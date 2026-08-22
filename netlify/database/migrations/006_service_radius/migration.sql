-- Correct the service-area radius drawn on the map.
--
-- The stand-in was 180 miles. The real area is Willows out to Elk Grove,
-- roughly 100 miles by road (about 89 straight-line). 100 covers every
-- town listed in area.towns, the farthest being Elk Grove:
--
--   Elk Grove 88.8 mi · Sacramento 75.2 · Redding 74.1
--   Clear Lake 45.5 · Chico 23.6
--
-- jsonb_set touches only area.map.radiusMiles so the town list, map
-- centre, zoom and any other admin CMS edits are preserved.

update content
set data = jsonb_set(data, '{area,map,radiusMiles}', '100'::jsonb, true),
    updated_at = now()
where id = 1;
