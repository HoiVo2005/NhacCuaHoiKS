-- =============================================================================
-- Xoa TOAN BO du lieu MAU do `npm run db:seed` tao ra, GIU LAI tai khoan quan tri.
--
-- Dung khi: da chay seed de xem thu, gio muon thu vien trang nhu that.
-- Cach chay:  npx prisma db execute --file scripts/wipe-sample-data.sql
--
-- LUU Y: `prisma migrate reset` cua Prisma 7 KHONG co co `--skip-seed` nen no se seed lai
-- du lieu vua xoa -> dung script nay thay the.
-- =============================================================================

-- 1) Xoa het du lieu nghiep vu (thu tu khong quan trong vi co CASCADE)
TRUNCATE TABLE
  "listen_history",
  "favorites",
  "playlist_songs",
  "playlists",
  "song_lyrics",
  "songs",
  "genres",
  "app_settings"
RESTART IDENTITY CASCADE;

-- 2) Xoa 3 tai khoan mau cua seed (tai khoan quan tri that duoc giu lai)
DELETE FROM "users"
WHERE "email" IN ('admin@mymusic.local', 'nhanvien@mymusic.local', 'thuha@mymusic.local');
