ALTER TABLE users ADD COLUMN provider TEXT;
ALTER TABLE users ADD COLUMN provider_user_id TEXT;

UPDATE users
SET provider = (
    SELECT auth_identities.provider
    FROM auth_identities
    WHERE auth_identities.user_id = users.id
    ORDER BY auth_identities.created_at ASC
    LIMIT 1
),
provider_user_id = (
    SELECT auth_identities.provider_user_id
    FROM auth_identities
    WHERE auth_identities.user_id = users.id
    ORDER BY auth_identities.created_at ASC
    LIMIT 1
);

CREATE UNIQUE INDEX users_provider_identity_idx ON users(provider, provider_user_id);
