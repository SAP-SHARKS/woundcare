import { createClient } from '@supabase/supabase-js';

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return send(res, 503, { error: 'Clinic administration is not configured.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '');
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return send(res, 401, { error: 'A valid signed-in session is required.' });

  const { action, organizationId, email, role, displayName, redirectTo } = req.body || {};
  if (!organizationId) return send(res, 400, { error: 'Organization is required.' });
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const isSuperAdmin = profile?.role === 'super_admin' || user.app_metadata?.role === 'super_admin';
  const { data: membership } = await admin.from('organization_memberships').select('role,status')
    .eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
  const isClinicAdmin = membership?.status === 'active' && ['clinic_admin', 'clinic_owner'].includes(membership.role);
  if (!isSuperAdmin && !isClinicAdmin) return send(res, 403, { error: 'Clinic administrator access is required.' });

  try {
    if (action === 'invite') {
      if (!email || !['clinic_admin', 'doctor', 'wound_specialist', 'nurse'].includes(role)) {
        return send(res, 400, { error: 'A valid email and role are required.' });
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { display_name: displayName || '', invited_organization_id: organizationId },
        redirectTo,
      });
      if (error) throw error;
      const { error: membershipError } = await admin.from('organization_memberships').upsert({
        organization_id: organizationId, user_id: data.user.id, role, status: 'inactive', invited_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' });
      if (membershipError) throw membershipError;
      return send(res, 200, { ok: true, message: `Invitation sent to ${normalizedEmail}. Activate access after they accept.` });
    }
    if (action === 'password_reset') {
      if (!email) return send(res, 400, { error: 'Email is required.' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data: targetProfile } = await admin.from('profiles').select('id').eq('email', normalizedEmail).maybeSingle();
      if (!targetProfile) return send(res, 404, { error: 'No clinic staff member has that email.' });
      const { data: targetMembership } = await admin.from('organization_memberships').select('id')
        .eq('organization_id', organizationId).eq('user_id', targetProfile.id).maybeSingle();
      if (!targetMembership) return send(res, 403, { error: 'That account does not belong to this clinic.' });
      const { error } = await admin.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) throw error;
      return send(res, 200, { ok: true, message: `Password reset email sent to ${normalizedEmail}.` });
    }
    return send(res, 400, { error: 'Unsupported action.' });
  } catch (error) {
    return send(res, 400, { error: error?.message || 'Clinic administration request failed.' });
  }
}
