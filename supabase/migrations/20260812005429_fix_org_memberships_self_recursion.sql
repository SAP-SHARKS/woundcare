/*
# Fix self-referencing recursion in organization_memberships RLS policies

## Problem
The organization_memberships SELECT policy references itself via a subquery
(om2 alias), causing "infinite recursion detected in policy for relation 
organization_memberships". The same issue affects INSERT, UPDATE, and DELETE
policies on this table.

## Solution
- SELECT: Allow users to see their own memberships (user_id = auth.uid()),
  super_admins to see all, and for the "same org" case use a SECURITY DEFINER
  function that bypasses RLS to check membership.
- INSERT/UPDATE/DELETE: Use the same SECURITY DEFINER function for clinic_admin
  checks to avoid self-referencing.

## Security
- The helper function is SECURITY DEFINER but only returns a boolean and
  takes explicit parameters, so it cannot be abused.
*/

-- Helper function to check if a user is an active member of an org with a specific role
-- Runs as SECURITY DEFINER to bypass RLS on organization_memberships (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND role = 'clinic_admin'
      AND status = 'active'
  );
$$;

-- Fix organization_memberships policies
DROP POLICY IF EXISTS "select_org_memberships" ON organization_memberships;
CREATE POLICY "select_org_memberships" ON organization_memberships FOR SELECT TO authenticated
USING (
  (user_id = auth.uid())
  OR public.is_super_admin()
  OR public.is_org_member(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "insert_org_memberships" ON organization_memberships;
CREATE POLICY "insert_org_memberships" ON organization_memberships FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_org_admin(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "update_org_memberships" ON organization_memberships;
CREATE POLICY "update_org_memberships" ON organization_memberships FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_org_admin(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "delete_org_memberships" ON organization_memberships;
CREATE POLICY "delete_org_memberships" ON organization_memberships FOR DELETE TO authenticated
USING (public.is_super_admin());

-- Also fix profiles SELECT policy - the organization_memberships join was also causing
-- recursion when org_memberships policies tried to read profiles
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT TO authenticated
USING (
  (id = auth.uid())
  OR public.is_super_admin()
  OR public.is_org_member(auth.uid(), organization_id)
);
