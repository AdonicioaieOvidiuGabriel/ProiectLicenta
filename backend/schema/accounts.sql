USE licentaconnect;

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_code VARCHAR(32) NOT NULL,
  role ENUM('student', 'professor', 'admin') NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  faculty VARCHAR(40) NULL,
  specialization VARCHAR(120) NULL,
  study_level VARCHAR(40) NULL,
  employee_title VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  approval_status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved',
  approval_reviewed_at TIMESTAMP NULL DEFAULT NULL,
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  email_verification_pin_hash VARCHAR(255) NULL,
  email_verification_expires_at TIMESTAMP NULL DEFAULT NULL,
  email_verification_sent_at TIMESTAMP NULL DEFAULT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_accounts_account_code (account_code),
  UNIQUE KEY uq_accounts_email (email),
  KEY idx_accounts_role (role),
  KEY idx_accounts_faculty (faculty),
  KEY idx_accounts_specialization (specialization),
  KEY idx_accounts_study_level (study_level)
);

INSERT INTO accounts (
  account_code,
  role,
  full_name,
  email,
  password_hash,
  faculty,
  specialization,
  study_level,
  employee_title,
  is_active,
  approval_status,
  approval_reviewed_at,
  email_verified_at,
  must_change_password
)
SELECT 'ADM-0001', 'admin', 'Administrator', 'admin@licentaconnect.ro', NULL, NULL, NULL, NULL, 'Administrator', 1, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE account_code = 'ADM-0001'
);
