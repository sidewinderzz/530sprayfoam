-- Point the About panel at Marc's attic clip.
--
-- His own Facebook footage, trimmed to drop the old-logo outro and encoded
-- with no audio stream at all, so it is silent regardless of what a browser
-- does with the muted attribute. app.js falls back to about.photo, and then
-- to the brand panel, if this is ever blanked in the admin.

update content
set data = jsonb_set(
             jsonb_set(data, '{about,video}', '"assets/about-attic.mp4"'::jsonb, true),
             '{about,videoPoster}', '"assets/about-attic-poster.jpg"'::jsonb, true),
    updated_at = now()
where id = 1;
