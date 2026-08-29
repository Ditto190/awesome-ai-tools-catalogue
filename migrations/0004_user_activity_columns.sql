ALTER TABLE users ADD COLUMN last_seen_at INTEGER;

UPDATE users
SET last_seen_at = updated_at
WHERE last_seen_at IS NULL;

CREATE INDEX users_created_at_idx ON users(created_at);
CREATE INDEX users_last_seen_at_idx ON users(last_seen_at);
