CREATE TABLE IF NOT EXISTS pending_registrations (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    verification_code VARCHAR(12),
    verification_code_expires_at TIMESTAMP,
    verification_failed_attempts INTEGER NOT NULL DEFAULT 0,
    age INTEGER,
    gender VARCHAR(1) CHECK (gender IN ('M', 'F')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pending_registrations (
    username,
    email,
    password_hash,
    verification_code,
    verification_code_expires_at,
    verification_failed_attempts,
    age,
    gender,
    created_at,
    updated_at
)
SELECT
    username,
    email,
    password,
    verification_code,
    verification_code_expires_at,
    verification_failed_attempts,
    age,
    gender,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM users
WHERE email_verified = FALSE
  AND role = 'CUSTOMER';

DELETE FROM users
WHERE email_verified = FALSE
  AND role = 'CUSTOMER';
