-- Add extended columns to clients table
-- These columns were added to schema.prisma but not yet in the database

ALTER TABLE clients
  ADD COLUMN company VARCHAR(255) NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN hourly_rate DECIMAL(10,2) NULL,
  ADD COLUMN contact_person VARCHAR(255) NULL,
  ADD COLUMN industry VARCHAR(255) NULL,
  ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  ADD COLUMN notes TEXT NULL,
  ADD COLUMN user_id VARCHAR(36) NULL;

CREATE INDEX clients_user_id_idx ON clients(user_id);
