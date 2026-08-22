-- Three client corrections, applied to the live CMS record.
--
-- 1. Recent work off. The client has no completed jobs yet; the four job
--    cards were stand-ins with invented towns, square footages and
--    timelines. work.enabled gates the section, and app.js additionally
--    requires a real photo on a job before it renders, so switching this
--    back on cannot resurrect the placeholders on its own.
--
-- 2. Roof coatings dropped from the About bullets. The client does not
--    offer them. Removed from index.html, app.js and the JSON-LD too.
--
-- 3. Map zoom out a touch. Willows stays the centre; map.js now honours
--    this value, which fitBounds previously overrode.
--
-- Each jsonb_set targets one key so unrelated admin edits survive.

update content
set data = jsonb_set(
             jsonb_set(
               jsonb_set(data, '{work,enabled}', 'false'::jsonb, true),
               '{about,points}', $pts$["Spray foam insulation — attics, crawlspaces, walls, shops and barns", "Removal of old batt and blown-in insulation", "Free walkthrough and a fixed price before we start"]$pts$::jsonb, true),
             '{area,map,zoom}', '6.4'::jsonb, true),
    updated_at = now()
where id = 1;
