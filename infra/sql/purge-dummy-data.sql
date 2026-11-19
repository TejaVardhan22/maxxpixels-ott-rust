-- ==============================================================================
-- Clean Production Database Purge Script
-- Removes all dummy/test content records and default sample accounts.
-- Preserves system infrastructure roles, categories, plans, legal pages, & settings.
-- ==============================================================================

TRUNCATE TABLE 
    movies, 
    contents, 
    series, 
    seasons, 
    episodes, 
    live_events, 
    banners, 
    section_items, 
    media_assets, 
    content_genres, 
    content_languages, 
    content_cast, 
    watch_history, 
    watchlist, 
    playback_sessions, 
    content_purchases, 
    tvod_products, 
    user_notifications 
RESTART IDENTITY CASCADE;

DELETE FROM user_roles WHERE user_id IN (
    SELECT id FROM users WHERE email IN ('producer@maxxpixels.com', 'tejavardhan185@gmail.com')
);

DELETE FROM users WHERE email IN ('producer@maxxpixels.com', 'tejavardhan185@gmail.com');
