/**
 * Fonctions utilitaires partagées pour l'API communautaire CharisHub.
 */

import { supabase } from '../supabase';
import logger from '../logger';
import type {
  CommunityKind,
  CommunityPost,
  CommunityComment,
  CommunityGroup,
  CommunityStory,
  CommunityGroupMember,
  CommunityCallProvider,
  LocalLikeMap,
  LocalGroupMember,
  LocalGroupMembersMap,
} from './types';

// ============================================================
// Constants
// ============================================================

export const KIND_PREFIX: Record<CommunityKind, string> = {
  general: '',
  prayer: '[PRIERE]',
  help: '[ENTRAIDE]',
  announcement: '[ANNONCE]',
  content: '[CONTENU]',
};

export const LS_POSTS_KEY = 'formation_biblique_local_posts_v1';
export const LS_COMMENTS_KEY = 'formation_biblique_local_comments_v1';
export const LS_STORIES_KEY = 'formation_biblique_local_stories_v1';
export const LS_LIKES_KEY = 'formation_biblique_local_likes_v1';
export const LS_GROUPS_KEY = 'formation_biblique_local_groups_v1';
export const LS_GROUP_MEMBERS_KEY = 'formation_biblique_local_group_members_v1';
export const INLINE_MEDIA_TAG = '[MEDIA_URL]';
export const INLINE_GROUP_TAG = '[GROUP_ID]';

export let likeStrategy: 'rpc' | 'counter' | 'local' = 'rpc';
export function setLikeStrategy(s: 'rpc' | 'counter' | 'local') { likeStrategy = s; }

export let announcementAdminCache: { value: boolean; expiresAt: number } | null = null;
export function setAnnouncementAdminCache(cache: { value: boolean; expiresAt: number } | null) {
  announcementAdminCache = cache;
}

// ============================================================
// Browser / Environment
// ============================================================

export function isBrowser() {
  return typeof window !== 'undefined';
}

export { supabase };

// ============================================================
// ID Generation
// ============================================================

export function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function cleanUuid(id: string | null | undefined): string {
  if (!id) return '';
  const parts = id.split('_');
  return parts.length > 1 && parts[0].length < 10 ? parts[parts.length - 1] : id;
}

// ============================================================
// Local Storage Helpers
// ============================================================

export function readLocal<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage write errors.
  }
}

// ============================================================
// Error Detection Helpers
// ============================================================

export function isMissingKindColumnError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42703' && message.includes('column') && message.includes('kind')) return true;
  if (code === 'PGRST204' && message.includes('kind')) return true;
  return (
    message.includes('could not find') &&
    message.includes("'kind'") &&
    message.includes('schema cache')
  );
}

export function isMissingColumnError(error: any, column: string): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42703' && message.includes('column') && message.includes(column.toLowerCase())) return true;
  if (code === 'PGRST204' && message.includes(column.toLowerCase())) return true;
  return (
    message.includes('could not find') &&
    message.includes(`'${column.toLowerCase()}'`) &&
    message.includes('schema cache')
  );
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('loading') ||
    message.includes('failed to connect') ||
    code === 'PGRST102' ||
    code === '0'
  );
}

export function isMissingTableError(error: any, table: string): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  if (code === '42P01' && message.includes(table.toLowerCase())) return true;
  if (code === 'PGRST205' && message.includes(table.toLowerCase())) return true;
  return (
    message.includes('could not find') &&
    message.includes(`'${table.toLowerCase()}'`) &&
    message.includes('schema cache')
  );
}

export function isNullViolationForColumn(error: any, column: string): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code !== '23502') return false;
  const needle = column.toLowerCase();
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return message.includes(needle) || details.includes(needle);
}

export function isPublicVisibilityRow(row: any): boolean {
  const visibility = String(row?.visibility ?? 'public').toLowerCase();
  if (!visibility) return true;
  return visibility === 'public';
}

// ============================================================
// Content Processing
// ============================================================

export function extractKindFromContent(content: string): { kind: CommunityKind; content: string } {
  const raw = content?.trim() || '';
  for (const [kind, prefix] of Object.entries(KIND_PREFIX) as Array<[CommunityKind, string]>) {
    if (!prefix) continue;
    if (raw.toUpperCase().startsWith(prefix)) {
      const cleaned = raw.slice(prefix.length).trimStart();
      return { kind, content: cleaned };
    }
  }
  return { kind: 'general', content: raw };
}

export function addKindPrefix(content: string, kind?: CommunityKind) {
  const safe = content?.trim() || '';
  if (!kind || kind === 'general') return safe;
  const prefix = KIND_PREFIX[kind];
  if (!prefix) return safe;
  return `${prefix} ${safe}`;
}

export function extractInlineMedia(content: string): { content: string; mediaUrl: string | null } {
  const raw = (content || '').trim();
  if (!raw) return { content: '', mediaUrl: null };

  const kept: string[] = [];
  let mediaUrl: string | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith(INLINE_MEDIA_TAG)) {
      const candidate = line.slice(INLINE_MEDIA_TAG.length).trim();
      if (candidate) mediaUrl = candidate;
      continue;
    }
    kept.push(line);
  }
  return {
    content: kept.join('\n').trim(),
    mediaUrl,
  };
}

export function extractInlineGroup(content: string): { content: string; groupId: string | null } {
  const raw = (content || '').trim();
  if (!raw) return { content: '', groupId: null };

  const kept: string[] = [];
  let groupId: string | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith(INLINE_GROUP_TAG)) {
      const candidate = line.slice(INLINE_GROUP_TAG.length).trim();
      if (candidate) groupId = candidate;
      continue;
    }
    kept.push(line);
  }
  return {
    content: kept.join('\n').trim(),
    groupId,
  };
}

// ============================================================
// Blob / File Helpers
// ============================================================

export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const metadata = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const mimeType = metadata.split(';')[0] || 'application/octet-stream';
  const isBase64 = metadata.includes(';base64');

  try {
    if (isBase64) {
      if (typeof atob !== 'function') return null;
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    }

    const decoded = decodeURIComponent(payload);
    return new Blob([decoded], { type: mimeType });
  } catch {
    return null;
  }
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('Conversion locale indisponible.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
    reader.readAsDataURL(file);
  });
}

export function inferFileExtension(file: File) {
  const raw = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const fromName = raw.replace(/[^a-z0-9]/g, '').slice(0, 8);
  if (fromName) return fromName;

  const mime = (file.type || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  return 'bin';
}

// ============================================================
// Normalizers
// ============================================================

export function normalizePost(row: any): CommunityPost {
  const withNoInlineMedia = extractInlineMedia(String(row?.content || ''));
  const withNoInlineGroup = extractInlineGroup(withNoInlineMedia.content);
  const extracted = extractKindFromContent(withNoInlineGroup.content);
  
  return {
    id: cleanUuid(row?.id),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    updated_at: row?.updated_at ? String(row.updated_at) : null,
    author_name: String(row?.author_name ?? row?.display_name ?? 'Invite').trim(),
    author_device_id: String(row?.author_device_id ?? row?.guest_id ?? row?.device_id ?? '').trim(),
    user_id: row?.user_id || null,
    content: extracted.content,
    media_url: row?.media_url ?? withNoInlineMedia.mediaUrl ?? null,
    media_type: row?.media_type ?? null,
    group_id: cleanUuid(row?.group_id ?? withNoInlineGroup.groupId),
    likes_count: Math.max(0, Number(row?.likes_count ?? 0)),
    comments_count: Math.max(0, Number(row?.comments_count ?? 0)),
    kind: (row?.kind || extracted.kind) as CommunityKind,
  };
}

export function normalizeComment(row: any): CommunityComment {
  return {
    id: cleanUuid(row?.id),
    post_id: cleanUuid(row?.post_id),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    author_name: String(row?.author_name ?? row?.display_name ?? 'Invite').trim(),
    author_device_id: String(row?.author_device_id ?? row?.guest_id ?? row?.device_id ?? '').trim(),
    user_id: row?.user_id || null,
    content: String(row?.content ?? '').trim(),
  };
}

export function normalizeGroup(row: any): CommunityGroup {
  return {
    id: cleanUuid(row?.id),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    name: String(row?.name ?? 'Sans nom').trim(),
    description: String(row?.description ?? '').trim(),
    group_type: (row?.group_type || 'study') as CommunityGroup['group_type'],
    created_by_name: String(row?.created_by_name ?? row?.display_name ?? 'Invite').trim(),
    created_by_device_id: String(row?.created_by_device_id ?? '').trim(),
    user_id: row?.user_id || null,
    call_provider: row?.call_provider || null,
    call_link: row?.call_link || null,
    next_call_at: row?.next_call_at || null,
    members_count: Math.max(0, Number(row?.members_count ?? 0)),
    joined: Boolean(row?.joined),
    membershipStatus: row?.membershipStatus || null,
    admin_ids: Array.isArray(row?.admin_ids)
      ? row.admin_ids
      : row?.created_by_device_id
        ? [String(row.created_by_device_id)]
        : [],
    is_paid: Boolean(row?.is_paid),
    price: Number(row?.price ?? 0),
    pass_code: row?.pass_code || '',
    session_tasks: Array.isArray(row?.session_tasks) ? row.session_tasks : [],
  };
}

// ============================================================
// Local Storage CRUD Helpers
// ============================================================

export function loadLocalPosts() {
  return readLocal<CommunityPost[]>(LS_POSTS_KEY, []);
}

export function saveLocalPosts(posts: CommunityPost[]) {
  writeLocal(LS_POSTS_KEY, posts);
}

export function loadLocalComments() {
  return readLocal<CommunityComment[]>(LS_COMMENTS_KEY, []);
}

export function saveLocalComments(comments: CommunityComment[]) {
  writeLocal(LS_COMMENTS_KEY, comments);
}

export function loadLocalStories() {
  return readLocal<CommunityStory[]>(LS_STORIES_KEY, []);
}

export function saveLocalStories(stories: CommunityStory[]) {
  writeLocal(LS_STORIES_KEY, stories);
}

export function loadLocalLikes() {
  return readLocal<LocalLikeMap>(LS_LIKES_KEY, {});
}

export function saveLocalLikes(likes: LocalLikeMap) {
  writeLocal(LS_LIKES_KEY, likes);
}

export function loadLocalGroups() {
  return readLocal<CommunityGroup[]>(LS_GROUPS_KEY, []).map(normalizeGroup);
}

export function saveLocalGroups(groups: CommunityGroup[]) {
  writeLocal(LS_GROUPS_KEY, groups);
}

export function loadLocalGroupMembers() {
  return readLocal<LocalGroupMembersMap>(LS_GROUP_MEMBERS_KEY, {});
}

export function saveLocalGroupMembers(map: LocalGroupMembersMap) {
  writeLocal(LS_GROUP_MEMBERS_KEY, map);
}

// ============================================================
// Auth / Admin Check
// ============================================================

export async function canPublishAnnouncement(): Promise<boolean> {
  if (!isBrowser()) return false;

  if (announcementAdminCache && announcementAdminCache.expiresAt > Date.now()) {
    return announcementAdminCache.value;
  }

  try {
    const headers: HeadersInit = {};
    const storedAdminKey = window.sessionStorage.getItem('formation_biblique_admin_panel_key') || '';
    if (storedAdminKey.trim()) {
      headers['x-admin-key'] = storedAdminKey.trim();
      headers['x-admin-actor'] = 'community_composer';
    }

    const response = await fetch('/api/admin/role', {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const payload = (await response.json()) as { ok?: boolean; isAdmin?: boolean };
    const allowed = !!payload?.ok && !!payload?.isAdmin;
    setAnnouncementAdminCache({ value: allowed, expiresAt: Date.now() + 60 * 1000 });
    return allowed;
  } catch {
    setAnnouncementAdminCache({ value: false, expiresAt: Date.now() + 15 * 1000 });
    return false;
  }
}

// ============================================================
// Media Upload
// ============================================================

export async function uploadCommunityMedia(file: File, authorDeviceId: string) {
  if (!file) throw new Error('Fichier media manquant.');

  if (!supabase) {
    return fileToDataUrl(file);
  }

  const safeDevice = (authorDeviceId || 'anon')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64) || 'anon';
  const ext = inferFileExtension(file);
  const fileName = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `community-chat/${safeDevice}/${fileName}`;

  let lastError: any = null;
  for (const bucket of ['community-media', 'stories']) {
    const attempt = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (attempt.error) {
      lastError = attempt.error;
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (data?.publicUrl) return data.publicUrl;
  }

  if (isBrowser() && file.size <= 6 * 1024 * 1024) {
    try {
      return await fileToDataUrl(file);
    } catch {
      // Ignore and throw dedicated upload error below.
    }
  }

  throw new Error(lastError?.message || 'Impossible de televerser le media.');
}

// ============================================================
// Group Admin Helper
// ============================================================

export function isGroupAdmin(group: CommunityGroup, deviceId: string) {
  if (!deviceId) return false;
  if (group.created_by_device_id === deviceId) return true;
  return group.admin_ids?.includes(deviceId) ?? false;
}
