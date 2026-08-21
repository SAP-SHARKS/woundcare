/*
  Trusted Super Admin bootstrap roster.

  This is intentionally limited to the two approved existing accounts. Auth
  app_metadata is server-managed and is what public.is_super_admin() checks.
  Users must sign out and back in after this migration to refresh their JWT.
*/

INSERT INTO public.profiles (id, role, display_name, email)
SELECT
  u.id,
  'super_admin',
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  u.email
FROM auth.users u
WHERE lower(u.email) IN (
  'zaid.aiesec@gmail.com',
  'bzuhaili@gmail.com'
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin',
    email = EXCLUDED.email;

UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'super_admin')
WHERE lower(email) IN (
  'zaid.aiesec@gmail.com',
  'bzuhaili@gmail.com'
);
