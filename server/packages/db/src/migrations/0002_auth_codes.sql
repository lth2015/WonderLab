-- Ported from yuha 0002: the auth_codes table and users.avatar_url only.
-- One-time codes issued at the end of the Google OAuth redirect, exchanged for
-- a session token by the SPA. Hashed at rest so a leaked row is not a session.
CREATE TABLE auth_codes (
  id         CHAR(36) CHARACTER SET ascii NOT NULL,
  code_hash  CHAR(64) CHARACTER SET ascii NOT NULL,
  user_id    CHAR(36) CHARACTER SET ascii NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY auth_codes_hash_uk (code_hash),
  KEY auth_codes_expiry_idx (expires_at),
  CONSTRAINT auth_codes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT auth_codes_used_chk CHECK (used_at IS NULL OR used_at <= expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
-- ;;
-- Google profile data for accounts created via "Sign in with Google".
ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(512) NULL
-- ;;

