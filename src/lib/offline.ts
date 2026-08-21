import { supabase } from './supabase';

const DB_NAME = 'woundtrack-offline';
const STORE = 'encrypted-queue';
const KEY_STORE = 'device-keys';
const SETTING_PREFIX = 'woundtrack:offline:';

export interface OfflineAssessmentBundle {
  localId: string;
  organizationId: string;
  patientId?: string;
  woundId: string;
  createdAt: string;
  assessment: Record<string, unknown>;
  photos: { name: string; type: string; dataUrl: string }[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deviceKey(): Promise<CryptoKey> {
  const db = await openDatabase();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const request = db.transaction(KEY_STORE).objectStore(KEY_STORE).get('primary');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(key, 'primary');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
  return key;
}

export function offlineSettingKey(organizationId: string) { return `${SETTING_PREFIX}${organizationId}`; }
export function isOfflineEnabled(organizationId: string | null) { return !!organizationId && localStorage.getItem(offlineSettingKey(organizationId)) === 'true'; }

export async function loadOfflineSetting(organizationId: string): Promise<boolean> {
  const { data, error } = await supabase.from('organization_feature_settings').select('offline_mode_enabled').eq('organization_id', organizationId).maybeSingle();
  if (!error && data) localStorage.setItem(offlineSettingKey(organizationId), String(data.offline_mode_enabled));
  return !error && data ? !!data.offline_mode_enabled : isOfflineEnabled(organizationId);
}

export async function saveOfflineSetting(organizationId: string, enabled: boolean): Promise<{ savedRemotely: boolean }> {
  localStorage.setItem(offlineSettingKey(organizationId), String(enabled));
  window.dispatchEvent(new CustomEvent('woundtrack:offline-setting', { detail: { organizationId, enabled } }));
  const { error } = await supabase.from('organization_feature_settings').upsert({ organization_id: organizationId, offline_mode_enabled: enabled, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
  return { savedRemotely: !error };
}

export async function enqueueOfflineAssessment(bundle: OfflineAssessmentBundle): Promise<void> {
  const key = await deviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put({ id: bundle.localId, organizationId: bundle.organizationId, createdAt: bundle.createdAt, iv, encrypted });
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
  window.dispatchEvent(new Event('woundtrack:queue-changed'));
}

export async function offlineQueueCount(organizationId: string): Promise<number> {
  const db = await openDatabase();
  const records = await new Promise<{ organizationId: string }[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return records.filter(record => record.organizationId === organizationId).length;
}
