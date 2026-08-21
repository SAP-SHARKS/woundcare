CREATE TABLE IF NOT EXISTS organization_feature_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  offline_mode_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE organization_feature_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read_org_feature_settings" ON organization_feature_settings FOR SELECT TO authenticated USING (public.is_super_admin() OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "admins_manage_org_feature_settings" ON organization_feature_settings FOR ALL TO authenticated USING (public.is_super_admin() OR public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_super_admin() OR public.is_org_admin(auth.uid(), organization_id));
