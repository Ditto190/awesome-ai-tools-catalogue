PRAGMA defer_foreign_keys = ON;

CREATE TABLE identity_migration_guard (
    orphan_count INTEGER NOT NULL CHECK (orphan_count = 0)
);

INSERT INTO identity_migration_guard (orphan_count)
SELECT
    (SELECT COUNT(*)
     FROM users
     WHERE provider IS NULL OR provider_user_id IS NULL)
    +
    (SELECT COUNT(*)
     FROM sessions
     LEFT JOIN users ON users.id = sessions.user_id
     WHERE users.id IS NULL)
    +
    (SELECT COUNT(*)
     FROM favorites
     LEFT JOIN users ON users.id = favorites.user_id
     WHERE users.id IS NULL);

DROP TABLE identity_migration_guard;

CREATE TABLE users_next (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    provider_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    github_username TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (id = provider || ':' || provider_user_id)
);

INSERT INTO users_next (
    id,
    provider,
    provider_user_id,
    display_name,
    email,
    avatar_url,
    github_username,
    email_verified,
    created_at,
    updated_at
)
SELECT
    provider || ':' || provider_user_id,
    provider,
    provider_user_id,
    display_name,
    email,
    avatar_url,
    github_username,
    email_verified,
    created_at,
    updated_at
FROM users;

CREATE TABLE sessions_next (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users_next(id) ON DELETE CASCADE
);

INSERT INTO sessions_next (token_hash, user_id, created_at, expires_at)
SELECT
    sessions.token_hash,
    users.provider || ':' || users.provider_user_id,
    sessions.created_at,
    sessions.expires_at
FROM sessions
JOIN users ON users.id = sessions.user_id;

CREATE TABLE favorites_next (
    user_id TEXT NOT NULL,
    tool_slug TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, tool_slug),
    FOREIGN KEY (user_id) REFERENCES users_next(id) ON DELETE CASCADE
);

INSERT INTO favorites_next (user_id, tool_slug, created_at)
SELECT
    users.provider || ':' || users.provider_user_id,
    favorites.tool_slug,
    favorites.created_at
FROM favorites
JOIN users ON users.id = favorites.user_id;

DROP TABLE IF EXISTS auth_identities;
DROP TABLE favorites;
DROP TABLE sessions;
DROP TABLE users;

ALTER TABLE users_next RENAME TO users;
ALTER TABLE sessions_next RENAME TO sessions;
ALTER TABLE favorites_next RENAME TO favorites;

CREATE UNIQUE INDEX users_provider_identity_idx ON users(provider, provider_user_id);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX favorites_user_created_idx ON favorites(user_id, created_at DESC);

PRAGMA defer_foreign_keys = OFF;
