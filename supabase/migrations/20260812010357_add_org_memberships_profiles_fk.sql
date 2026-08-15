/*
# Add foreign key from organization_memberships to profiles

## Problem
The Staff page joins organization_memberships with profiles via PostgREST,
but no FK relationship exists between them. The existing FK goes to auth.users.

## Solution
Add a second FK from organization_memberships.user_id to profiles.id so
PostgREST can detect the relationship and allow the join.

## Tables modified
- organization_memberships: new FK constraint referencing profiles(id)

## Security
- No policy changes needed.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_memberships_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE organization_memberships
    ADD CONSTRAINT organization_memberships_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;
