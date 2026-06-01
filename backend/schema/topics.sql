CREATE DATABASE IF NOT EXISTS licentaconnect
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE licentaconnect;

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  facultatea VARCHAR(20) NOT NULL,
  profesor VARCHAR(255) NOT NULL,
  nivel_studii VARCHAR(40) NOT NULL,
  specializari JSON NOT NULL,
  titlu_tema VARCHAR(500) NOT NULL,
  descriere TEXT NULL,
  source_file VARCHAR(120) NULL,
  creator_account_id BIGINT NULL,
  creator_email VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_topics_faculty (facultatea),
  INDEX idx_topics_level (nivel_studii),
  INDEX idx_topics_professor (profesor),
  INDEX idx_topics_title (titlu_tema),
  INDEX idx_topics_creator_account (creator_account_id)
);
