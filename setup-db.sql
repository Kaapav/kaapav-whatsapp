-- Clean slate
DELETE FROM sessions;

-- Insert admin user (ignore if exists)
INSERT OR IGNORE INTO users (user_id, email, password_hash, name, role, is_active, created_at)
VALUES ('usr_kaapav_001', 'kaapavin@gmail.com', 'kaapav123', 'KAAPAV Owner', 'admin', 1, datetime('now'));

-- Verify
SELECT 'USERS:' as table_name;
SELECT user_id, email, name, role, is_active FROM users;

SELECT 'SESSIONS:' as table_name;
SELECT COUNT(*) as count FROM sessions;
