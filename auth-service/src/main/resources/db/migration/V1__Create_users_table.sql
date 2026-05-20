CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code VARCHAR(12),
    verification_code_expires_at TIMESTAMP,
    verification_failed_attempts INTEGER NOT NULL DEFAULT 0,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN')),
    age INTEGER,
    gender VARCHAR(1) CHECK (gender IN ('M', 'F'))
);
