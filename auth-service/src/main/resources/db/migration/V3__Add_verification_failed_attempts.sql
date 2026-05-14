ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verification_failed_attempts INTEGER NOT NULL DEFAULT 0;
