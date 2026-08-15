import { supabase } from './supabase';

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  organizationId: string | null,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from('audit_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    organization_id: organizationId,
    metadata,
  });
}
