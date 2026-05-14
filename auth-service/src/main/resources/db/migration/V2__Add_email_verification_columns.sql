ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS verification_code VARCHAR(12),
    ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP;

UPDATE users
SET email_verified = TRUE
WHERE role = 'ADMIN';
