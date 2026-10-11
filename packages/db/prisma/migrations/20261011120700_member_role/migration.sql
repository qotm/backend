-- The template's default role `user` is now `member` (QOT-27). Data only: the
-- role column is better-auth's comma-separated string.
UPDATE "user" SET "role" = 'member' WHERE "role" IS NULL OR "role" = 'user';
UPDATE "user" SET "role" = regexp_replace("role", '(^|,)\s*user\s*(,|$)', '\1member\2', 'g')
  WHERE "role" ~ '(^|,)\s*user\s*(,|$)';
