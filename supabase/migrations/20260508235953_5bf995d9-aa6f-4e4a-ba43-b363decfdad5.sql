ALTER TYPE vault_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE vault_status ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE public.vaults
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_step text;