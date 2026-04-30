import logger from '@/lib/logger';
import { supabase } from '../lib/supabase';
import { renderVerseStoryPng } from '../lib/storyImage';

/**
 * Wrapper fetch qui injecte le token Bearer Supabase pour les appels API internes.
 */
async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // Silently continue without auth token
    }
  }
  return fetch(url, { ...init, headers });
}


export type CommunityPost = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  author_name: string;
  author_device_id: string;
  user_id?: string | null;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  group_id?: string | null;
  likes_count: number;
  comments_count: number;
  kind?: CommunityKind;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  user_id?: string | null;
  content: string;
};

type DeletePostResult = { ok: true };

export type CommunityKind = 'general' | 'prayer' | 'help' | 'announcement' | 'content';

export type CommunityStoryKind = 'verse' | 'text' | 'image';
export type CommunityStoryConfig = {
  background?: string; // gradient name, hex color, or image url
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontFamily?: string;
};

export type CommunityStory = {
  id: string;
  created_at: string;
  author_name: string;
  author_device_id: string;
  user_id?: string | null;
  verse_text: string;
  verse_reference: string;
  image_url?: string | null;
  kind?: CommunityStoryKind;
  config?: CommunityStoryConfig;
  likes_count?: number;
};

export type CommunityReportReason = 'spam' | 'harassment' | 'illegal' | 'other';

type LocalLikeMap = Record<string, string[]>;
type LocalGroupMember = {
  device_id: string;
  display_name: string;
  joined_at: string;
  status: CommunityGroupMemberStatus;
};
type LocalGroupMembersMap = Record<string, LocalGroupMember[]>;

export type CommunityGroupType = 'prayer' | 'study' | 'support' | 'general' | 'formation';
export type CommunityCallProvider = 'google_meet' | 'facetime' | 'skype' | 'other';

export type CommunityGroup = {
  id: string;
  created_at: string;
  name: string;
  description: string;
  group_type: CommunityGroupType;
  created_by_name: string;
  created_by_device_id: string;
  user_id?: string | null;
  call_provider?: CommunityCallProvider | null;
  call_link?: string | null;
  next_call_at?: string | null;
  members_count: number;
  joined: boolean;
  membershipStatus?: CommunityGroupMemberStatus | null;
  admin_ids?: string[]; // IDs des membres ayant des droits d'admin (créateur + 2 max)
  is_paid?: boolean;
  price?: number;
  pass_code?: string;
  pass_code?: string;
  session_tasks?: string[];
  challenges_count?: number;
};

export type CommunityChallengeType = 'bible_reading' | 'prayer' | 'custom';

export type CommunityChallenge = {
  id: string;
  group_id: string;
  created_by?: string | null;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  target_type: CommunityChallengeType;
  target_config: any;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  participants_count?: number;
  my_progress?: CommunityChallengeParticipant | null;
};

export type CommunityChallengeParticipant = {
  id: string;
  challenge_id: string;
  user_id?: string | null;
  device_id: string;
  progress: any;
  progress_percent: number;
  completed_at?: string | null;
  joined_at: string;
  updated_at: string;
};

export type CommunityGroupMemberStatus = 'pending' | 'approved' | 'rejected';

export type CommunityGroupMember = {
  group_id: string;
  device_id: string;
  user_id?: string | null;
  display_name: string;
  joined_at: string;
  status: CommunityGroupMemberStatus;
};

export type CommunityGroupCallEventType =
  | 'join'
  | 'leave'
  | 'mute'
  | 'unmute'
  | 'video_on'
  | 'video_off'
  | 'mode_audio'
  | 'mode_video'
  | 'error';

export type CommunityGroupCallPresence = {
  group_id: string;
  device_id: string;
  guest_id?: string;
  display_name: string;
  audio_enabled: boolean;
  video_enabled: boolean;
  joined_at: string;
  last_seen_at: string;
  shared_bible_ref?: string | null;
  shared_bible_content?: string | null;
  prayerFlowOpen?: boolean;
  prayerFlowStepIndex?: number;
};

export type GroupCallSession = {
  id: string;
  group_id: string;
  room_id: string;
  created_by: string;
  status: 'ringing' | 'active' | 'ended';
  started_at: string;
  ended_at?: string | null;
  created_at: string;
};

const KIND_PREFIX: Record<CommunityKind, string> = {
  general: '',
  prayer: '[PRIERE]',
  help: '[ENTRAIDE]',
  announcement: '[ANNONCE]',
  content: '[CONTENU]',
};

const LS_POSTS_KEY = 'formation_biblique_local_posts_v1';
const LS_COMMENTS_KEY = 'formation_biblique_local_comments_v1';
const LS_STORIES_KEY = 'formation_biblique_local_stories_v1';
const LS_LIKES_KEY = 'formation_biblique_local_likes_v1';
const LS_GROUPS_KEY = 'formation_biblique_local_groups_v1';
const LS_GROUP_MEMBERS_KEY = 'formation_biblique_local_group_members_v1';
const INLINE_MEDIA_TAG = '[MEDIA_URL]';
const INLINE_GROUP_TAG = '[GROUP_ID]';
let likeStrategy: 'rpc' | 'counter' | 'local' = 'rpc';
let announcementAdminCache: { value: boolean; expiresAt: number } | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

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

    const response = await authFetch('/api/admin/role', {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const payload = (await response.json()) as { ok?: boolean; isAdmin?: boolean };
    const allowed = !!payload?.ok && !!payload?.isAdmin;
    announcementAdminCache = { value: allowed, expiresAt: Date.now() + 60 * 1000 };
    return allowed;
  } catch {
    announcementAdminCache = { value: false, expiresAt: Date.now() + 15 * 1000 };
    return false;
  }
}

function makeId(prefix: string) {
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

function readLocal<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage write errors.
  }
}

function isMissingKindColumnError(error: any): boolean {
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

function isMissingColumnError(error: any, column: string): boolean {
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

function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  // Supabase/Postgrest network errors often manifest as broad errors or 0/null status codes
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('loading') ||
    message.includes('failed to connect') ||
    code === 'PGRST102' ||
    code === '0'
  );
}

function isMissingTableError(error: any, table: string): boolean {
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

function isNullViolationForColumn(error: any, column: string): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code !== '23502') return false;
  const needle = column.toLowerCase();
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return message.includes(needle) || details.includes(needle);
}

function isPublicVisibilityRow(row: any): boolean {
  const visibility = String(row?.visibility ?? 'public').toLowerCase();
  if (!visibility) return true;
  return visibility === 'public';
}

function extractKindFromContent(content: string): { kind: CommunityKind; content: string } {
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

function addKindPrefix(content: string, kind?: CommunityKind) {
  const safe = content?.trim() || '';
  if (!kind || kind === 'general') return safe;
  const prefix = KIND_PREFIX[kind];
  if (!prefix) return safe;
  if (safe.toUpperCase().startsWith(prefix)) return safe;
  return `${prefix} ${safe}`.trim();
}

function appendInlineMedia(content: string, mediaUrl?: string | null) {
  const base = (content || '').trim();
  const media = (mediaUrl || '').trim();
  if (!media) return base;
  if (base.includes(`${INLINE_MEDIA_TAG}${media}`)) return base;
  return `${base}\n\n${INLINE_MEDIA_TAG}${media}`.trim();
}

function appendInlineGroup(content: string, groupId?: string | null) {
  const base = (content || '').trim();
  const group = (groupId || '').trim();
  if (!group) return base;
  if (base.includes(`${INLINE_GROUP_TAG}${group}`)) return base;
  return `${base}\n\n${INLINE_GROUP_TAG}${group}`.trim();
}

function extractInlineMedia(content: string): { content: string; mediaUrl: string | null } {
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

function extractInlineGroup(content: string): { content: string; groupId: string | null } {
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

function dataUrlToBlob(dataUrl: string): Blob | null {
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

function fileToDataUrl(file: File) {
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

export async function triggerGroupCallScheduledPush(payload: {
  groupId: string;
  adminName: string;
  nextCallAt: string;
  groupName: string;
}) {
  if (!supabase) return;
  const channel = supabase.channel(`group_activity:${payload.groupId}`);
  await channel.subscribe(async (status: string) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({
        type: 'broadcast',
        event: 'call_scheduled',
        payload: {
          ...payload,
          sent_at: new Date().toISOString(),
        }
      });
      await channel.unsubscribe();
    }
  });
}

function inferFileExtension(file: File) {
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

  // Ultimate fallback to keep feature usable when storage is misconfigured.
  if (isBrowser() && file.size <= 6 * 1024 * 1024) {
    try {
      return await fileToDataUrl(file);
    } catch {
      // Ignore and throw dedicated upload error below.
    }
  }

  throw new Error(lastError?.message || 'Impossible de televerser le media.');
}

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

function normalizeComment(row: any): CommunityComment {
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

function loadLocalPosts() {
  return readLocal<CommunityPost[]>(LS_POSTS_KEY, []);
}

function saveLocalPosts(posts: CommunityPost[]) {
  writeLocal(LS_POSTS_KEY, posts);
}

function loadLocalComments() {
  return readLocal<CommunityComment[]>(LS_COMMENTS_KEY, []);
}

function saveLocalComments(comments: CommunityComment[]) {
  writeLocal(LS_COMMENTS_KEY, comments);
}

function loadLocalStories() {
  return readLocal<CommunityStory[]>(LS_STORIES_KEY, []);
}

function saveLocalStories(stories: CommunityStory[]) {
  writeLocal(LS_STORIES_KEY, stories);
}

function loadLocalLikes() {
  return readLocal<LocalLikeMap>(LS_LIKES_KEY, {});
}

function saveLocalLikes(likes: LocalLikeMap) {
  writeLocal(LS_LIKES_KEY, likes);
}

function localFetchPosts(limit: number, kind?: CommunityKind, groupId?: string | null) {
  const items = loadLocalPosts()
    .map(normalizePost)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const normalizedGroupId = groupId ? cleanUuid(groupId) : '';
  const byGroup = groupId
    ? items.filter((item: CommunityPost) => cleanUuid(item.group_id || '') === normalizedGroupId)
    : items.filter((item: CommunityPost) => !item.group_id);
  const filtered =
    kind && kind !== 'general' ? byGroup.filter((item: CommunityPost) => item.kind === kind) : byGroup;
  return filtered.slice(0, Math.max(1, limit));
}

function localFetchPostById(postId: string) {
  if (!postId) return null;
  const found = loadLocalPosts().map(normalizePost).find((post) => post.id === postId);
  return found ?? null;
}

function localCreatePost(payload: {
  author_name: string;
  author_device_id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  kind?: CommunityKind;
  group_id?: string | null;
}) {
  const cleanContent = payload.content?.trim() || '';
  const post: CommunityPost = {
    id: makeId('post'),
    created_at: new Date().toISOString(),
    updated_at: null,
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    content: cleanContent,
    media_url: payload.media_url ?? null,
    media_type: payload.media_type ?? null,
    group_id: cleanUuid(payload.group_id ?? '') || null,
    likes_count: 0,
    comments_count: 0,
    kind: payload.kind || 'general',
  };
  const next = [post, ...loadLocalPosts()];
  saveLocalPosts(next);
  return post;
}

function localUpdatePost(
  postId: string,
  actorDeviceId: string,
  payload: {
    content?: string;
    media_url?: string | null;
    media_type?: string | null;
  }
) {
  const posts = loadLocalPosts();
  const target = posts.find((post) => post.id === postId);
  if (!target || target.author_device_id !== actorDeviceId) {
    throw new Error('Modification non autorisee.');
  }

  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      content: payload.content ?? post.content,
      media_url: payload.media_url ?? post.media_url ?? null,
      media_type: payload.media_type ?? post.media_type ?? null,
      updated_at: new Date().toISOString(),
    };
  });
  saveLocalPosts(next);
  return normalizePost(next.find((post) => post.id === postId));
}

function localDeletePost(postId: string, actorDeviceId: string): DeletePostResult {
  const posts = loadLocalPosts();
  const target = posts.find((post) => post.id === postId);
  if (!target || target.author_device_id !== actorDeviceId) {
    throw new Error('Suppression non autorisee.');
  }

  saveLocalPosts(posts.filter((post) => post.id !== postId));
  saveLocalComments(loadLocalComments().filter((comment) => comment.post_id !== postId));

  const likes = loadLocalLikes();
  if (likes[postId]) {
    delete likes[postId];
    saveLocalLikes(likes);
  }

  return { ok: true };
}

function localToggleLike(postId: string, deviceId: string) {
  const likes = loadLocalLikes();
  const current = new Set(likes[postId] ?? []);
  if (current.has(deviceId)) current.delete(deviceId);
  else current.add(deviceId);
  likes[postId] = Array.from(current);
  saveLocalLikes(likes);

  const posts = loadLocalPosts().map((item: CommunityPost) =>
    item.id === postId ? { ...item, likes_count: likes[postId].length } : item
  );
  saveLocalPosts(posts);
  return { likes_count: likes[postId].length };
}

function localFetchComments(postId: string) {
  return loadLocalComments()
    .filter((comment) => comment.post_id === postId)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function localAddComment(payload: {
  post_id: string;
  author_name: string;
  author_device_id: string;
  content: string;
}) {
  const nextComment: CommunityComment = {
    id: makeId('comment'),
    post_id: payload.post_id,
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    content: payload.content.trim(),
    created_at: new Date().toISOString(),
  };
  const comments = [...loadLocalComments(), nextComment];
  saveLocalComments(comments);

  const posts = loadLocalPosts().map((item: CommunityPost) =>
    item.id === payload.post_id
      ? { ...item, comments_count: Math.max(0, (item.comments_count || 0) + 1) }
      : item
  );
  saveLocalPosts(posts);
  return nextComment;
}

function localCreateStory(payload: {
  author_name: string;
  author_device_id: string;
  verse_reference: string;
  verse_text: string;
  image_data_url?: string;
}) {
  const story: CommunityStory = {
    id: makeId('story'),
    created_at: new Date().toISOString(),
    author_name: payload.author_name,
    author_device_id: payload.author_device_id,
    verse_reference: payload.verse_reference,
    verse_text: payload.verse_text,
    image_url: payload.image_data_url || null,
  };
  const nextStories = [story, ...loadLocalStories()];
  saveLocalStories(nextStories);
  return story;
}

function localFetchStories(limit: number) {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  return loadLocalStories()
    .filter((s) => new Date(s.created_at).getTime() > yesterday)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, Math.max(1, limit));
}

function normalizeGroupType(value: unknown): CommunityGroupType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'prayer' || raw === 'study' || raw === 'support' || raw === 'formation') return raw;
  return 'general';
}

function normalizeCallProvider(value: unknown): CommunityCallProvider | null {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'google_meet' || raw === 'facetime' || raw === 'skype' || raw === 'other') {
    return raw;
  }
  return null;
}

function normalizeGroup(row: any, options?: { membersCount?: number; joined?: boolean }): CommunityGroup {
  const creatorId = String(row?.created_by_device_id ?? row?.created_by ?? row?.guest_id ?? row?.author_device_id ?? row?.device_id ?? '').trim();
  return {
    id: cleanUuid(row?.id),
    created_at: String(row?.created_at ?? new Date().toISOString()),
    name: String(row?.name ?? row?.title ?? '').trim(),
    description: String(row?.description ?? ''),
    group_type: normalizeGroupType(row?.group_type),
    created_by_name: String(row?.created_by_name ?? row?.author_name ?? 'Invite'),
    created_by_device_id: creatorId,
    user_id: row?.user_id || null,
    call_provider: normalizeCallProvider(row?.call_provider),
    call_link: row?.call_link ? String(row.call_link) : null,
    next_call_at: row?.next_call_at ? String(row.next_call_at) : null,
    members_count: Math.max(0, Number(options?.membersCount ?? row?.members_count ?? 0)),
    joined: Boolean(options?.joined ?? row?.joined ?? false),
    admin_ids: Array.isArray(row?.admin_ids) ? row.admin_ids : [creatorId],
    is_paid: Boolean(row?.is_paid),
    price: Math.max(0, Number(row?.price ?? 0)),
    pass_code: String(row?.pass_code ?? ''),
    session_tasks: Array.isArray(row?.session_tasks) ? row.session_tasks : [],
  };
}

function normalizeGroupMember(row: any, groupId: string): CommunityGroupMember | null {
  const actorId = String(row?.device_id ?? row?.guest_id ?? row?.author_device_id ?? '').trim();
  if (!actorId) return null;
  const joinedAt = String(row?.joined_at ?? row?.created_at ?? new Date().toISOString());
  return {
    group_id: String(row?.group_id ?? groupId),
    device_id: actorId,
    display_name: String(row?.display_name ?? row?.author_name ?? 'Invite').trim() || 'Invite',
    joined_at: joinedAt,
    user_id: row?.user_id || null,
    status: (row?.status as CommunityGroupMemberStatus) || 'approved',
  };
}

function loadLocalGroups() {
  return readLocal<CommunityGroup[]>(LS_GROUPS_KEY, []);
}

function saveLocalGroups(groups: CommunityGroup[]) {
  writeLocal(LS_GROUPS_KEY, groups);
}

function loadLocalGroupMembers() {
  return readLocal<LocalGroupMembersMap>(LS_GROUP_MEMBERS_KEY, {});
}

function saveLocalGroupMembers(map: LocalGroupMembersMap) {
  writeLocal(LS_GROUP_MEMBERS_KEY, map);
}

function ensureLocalCreatorMembership(groupId: string, deviceId: string, displayName: string) {
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  if (members.some((item: LocalGroupMember) => item.device_id === deviceId)) return;
  membersMap[groupId] = [
    ...members,
    {
      device_id: deviceId,
      display_name: displayName || 'Invite',
      joined_at: new Date().toISOString(),
      status: 'approved',
    },
  ];
  saveLocalGroupMembers(membersMap);
}

function localFetchGroups(limit: number, deviceId?: string) {
  const items = loadLocalGroups()
    .map((group) => normalizeGroup(group))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const membersMap = loadLocalGroupMembers();
  const result = items.map((group) => {
    const members = membersMap[group.id] ?? [];
    return normalizeGroup(group, {
      membersCount: members.length,
      joined: !!deviceId && members.some((item: LocalGroupMember) => item.device_id === deviceId),
    });
  });
  return result.slice(0, Math.max(1, limit));
}

function localFetchGroupMembers(groupId: string, limit: number) {
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  return members
    .map((member) => ({
      group_id: groupId,
      device_id: member.device_id,
      display_name: member.display_name || 'Invite',
      joined_at: member.joined_at || new Date().toISOString(),
      status: member.status || 'approved',
    }))
    .sort((a, b) => +new Date(a.joined_at) - +new Date(b.joined_at))
    .slice(0, Math.max(1, limit));
}

function localCreateGroup(payload: {
  name: string;
  description?: string;
  group_type?: CommunityGroupType;
  created_by_name: string;
  created_by_device_id: string;
  call_provider?: CommunityCallProvider | null;
  call_link?: string | null;
  next_call_at?: string | null;
  is_paid?: boolean;
  price?: number;
  pass_code?: string;
  user_id?: string | null;
}) {
  const group = normalizeGroup({
    id: makeId('group'),
    created_at: new Date().toISOString(),
    name: payload.name.trim(),
    description: (payload.description || '').trim(),
    group_type: payload.group_type || 'general',
    created_by_name: payload.created_by_name,
    created_by_device_id: payload.created_by_device_id,
    call_provider: payload.call_provider || null,
    call_link: payload.call_link || null,
    next_call_at: payload.next_call_at || null,
    members_count: 1,
    joined: true,
    admin_ids: [payload.created_by_device_id],
    is_paid: payload.is_paid || false,
    price: payload.price || 0,
    pass_code: payload.pass_code || '',
    user_id: payload.user_id || null,
  });
  
  const current = loadLocalGroups();
  if (current.some(g => g.name === group.name && g.description === group.description)) {
    return current.find(g => g.name === group.name && g.description === group.description)!;
  }

  saveLocalGroups([group, ...current]);
  ensureLocalCreatorMembership(group.id, payload.created_by_device_id, payload.created_by_name);
  return group;
}

function localDeleteGroup(groupId: string, actorDeviceId?: string) {
  const groups = loadLocalGroups();
  const target = groups.find((group) => group.id === groupId);
  if (!target) return { ok: true };
  if (actorDeviceId && target.created_by_device_id !== actorDeviceId) {
    throw new Error('Vous pouvez supprimer uniquement les groupes que vous avez créés.');
  }

  const next = groups.filter((g) => g.id !== groupId);
  if (next.length !== groups.length) {
    saveLocalGroups(next);
  }

  const membersMap = loadLocalGroupMembers();
  if (membersMap[groupId]) {
    delete membersMap[groupId];
    saveLocalGroupMembers(membersMap);
  }

  return { ok: true };
}

function localJoinGroup(groupId: string, deviceId: string, displayName: string) {
  const groups = loadLocalGroups();
  if (!groups.some((item: CommunityGroup) => item.id === groupId)) throw new Error('Groupe introuvable.');
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  if (!members.some((item: LocalGroupMember) => item.device_id === deviceId)) {
    membersMap[groupId] = [
      ...members,
      {
        device_id: deviceId,
        display_name: displayName || 'Invite',
        joined_at: new Date().toISOString(),
        status: 'approved', // En local, on approuve tout par simplicité
      },
    ];
    saveLocalGroupMembers(membersMap);
  }
}

function localLeaveGroup(groupId: string, deviceId: string) {
  const membersMap = loadLocalGroupMembers();
  const members = membersMap[groupId] ?? [];
  membersMap[groupId] = members.filter((item: LocalGroupMember) => item.device_id !== deviceId);
  saveLocalGroupMembers(membersMap);
}

function localUpdateGroup(
  groupId: string,
  payload: {
    call_provider?: CommunityCallProvider | null;
    call_link?: string | null;
    next_call_at?: string | null;
    description?: string;
    admin_ids?: string[];
  }
) {
  const next = loadLocalGroups().map((group) => {
    if (group.id !== groupId) return group;
    return normalizeGroup({
      ...group,
      call_provider: payload.call_provider ?? group.call_provider ?? null,
      call_link: payload.call_link ?? group.call_link ?? null,
      next_call_at: payload.next_call_at ?? group.next_call_at ?? null,
      description: payload.description ?? group.description ?? '',
      admin_ids: payload.admin_ids ?? group.admin_ids ?? [group.created_by_device_id],
    });
  });
  saveLocalGroups(next);
  return next.find((group) => group.id === groupId) ?? null;
}

export function isGroupAdmin(group: CommunityGroup, deviceId: string) {
  if (!deviceId) return false;
  if (group.created_by_device_id === deviceId) return true;
  return group.admin_ids?.includes(deviceId) ?? false;
}

function createAutoStoryImageDataUrl(verseReference: string, verseText: string) {
  const ref = (verseReference || '').trim() || 'Reference';
  const txt = (verseText || '').trim() || 'Texte indisponible';
  const safeText = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeRef = ref.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const wrapped: string[] = [];
  const words = safeText.split(/\s+/).filter(Boolean);
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 34) {
      if (line) wrapped.push(line);
      line = word;
      if (wrapped.length >= 7) break;
      continue;
    }
    line = next;
  }
  if (line && wrapped.length < 8) wrapped.push(line);
  const lines = wrapped.slice(0, 8);

  const textNodes = lines
    .map((l, i) => `<tspan x="64" dy="${i === 0 ? 0 : 42}">${l}</tspan>`)
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="55%" stop-color="#102347"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="48" y="48" width="984" height="1824" rx="46" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
  <text x="64" y="164" fill="#93c5fd" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="42" font-weight="700">${safeRef}</text>
  <text x="64" y="300" fill="#f8fafc" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="52" font-weight="700">${textNodes}</text>
  <text x="64" y="1838" fill="rgba(255,255,255,0.82)" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34">Miroir · Identité & Grâce</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function triggerCommunityPostPush(post: CommunityPost, actorDeviceId: string) {
  if (!isBrowser()) return;
  try {
    const text = (post.content || '').replace(/\s+/g, ' ').trim();
    const body =
      text.length > 120 ? `${text.slice(0, 119)}…` : text || 'Nouveau message dans Communaute';
    const title = `${post.author_name || 'Quelqu un'} a publie`;
    const postUrl = post.group_id
      ? `/groups?group=${encodeURIComponent(post.group_id)}`
      : '/groups';
    const tag = post.id ? `post-${post.id}` : 'community-post';
    await authFetch('/api/push/community-post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actorDeviceId,
        actorUserId: (post as any).author_user_id || null,
        title,
        body,
        url: postUrl,
        tag,
      }),
    });
  } catch {
    // Ignore push errors to keep posting flow fast.
  }
}

export async function triggerGroupCallPush(payload: {
  groupId: string;
  callerDeviceId: string;
  callerUserId?: string | null;
  callerDisplayName: string;
  callType: 'audio' | 'video';
  groupName?: string;
  callId?: string | null;
}) {
  if (!isBrowser()) return;
  try {
    if (supabase) {
      const channelNames = [`group-call:${payload.groupId}`, `group:${payload.groupId}`];
      const promises: Promise<void>[] = [];
      
      channelNames.forEach((channelName) => {
        const pushPromise = new Promise<void>((resolve) => {
          try {
            const channel = supabase.channel(channelName);

            const sendPayload = async () => {
              try {
                await channel.send({
                  type: 'broadcast',
                  event: 'call.invite',
                  payload: {
                    callId: payload.callId,
                    groupId: payload.groupId,
                    startedBy: payload.callerDeviceId,
                    callerName: payload.callerDisplayName,
                    callerUserId: payload.callerUserId,
                    type: payload.callType,
                    groupName: payload.groupName,
                  },
                });
              } catch (e) {
                logger.error(`[triggerGroupCallPush] Broadcast failed on ${channelName}:`, e);
              } finally {
                resolve();
              }
            };

            // Si déjà abonné, on envoie direct
            if ((channel as any).state === 'joined') {
              void sendPayload();
            } else {
              channel.subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                  await sendPayload();
                } else {
                  // Timeout ou erreur, on résout quand même pour ne pas bloquer
                  setTimeout(resolve, 2000);
                }
              });
            }
          } catch (e) {
            logger.error(`[triggerGroupCallPush] Error on ${channelName}:`, e);
            resolve();
          }
        });
        promises.push(pushPromise);
      });

      // Attendre que tous les broadcasts soient envoyés
      await Promise.all(promises);
    }

    await authFetch('/api/push/group-call-notification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignore push errors.
  }
}

export async function startGroupCallSession(payload: {
  groupId: string;
  userId: string;
  userName: string;
}): Promise<GroupCallSession | null> {
  if (!isBrowser()) return null;

  const response = await authFetch('/api/group-call/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    call?: Partial<GroupCallSession>;
    callId?: string;
    roomId?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || 'Impossible de démarrer l’appel de groupe.');
  }

  const call = body.call;
  const callId = String(call?.id || body.callId || '').trim();
  if (!callId) return null;

  return {
    id: callId,
    group_id: String(call?.group_id || payload.groupId),
    room_id: String(call?.room_id || body.roomId || ''),
    created_by: String(call?.created_by || payload.userId),
    status: (call?.status as GroupCallSession['status']) || 'ringing',
    started_at: String(call?.started_at || call?.created_at || new Date().toISOString()),
    ended_at: call?.ended_at ? String(call.ended_at) : null,
    created_at: String(call?.created_at || new Date().toISOString()),
  };
}

export async function activateGroupCallSession(callId: string, deviceId: string) {
  if (!isBrowser() || !callId || !deviceId) return false;

  const response = await authFetch('/api/group-call/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callId, deviceId }),
  });

  return response.ok;
}

export async function endGroupCallSession(callId: string, deviceId: string) {
  if (!isBrowser() || !callId || !deviceId) return false;

  const response = await authFetch('/api/group-call/end', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callId, deviceId }),
  });

  return response.ok;
}

export async function respondToGroupCallInvitation(
  callId: string,
  userId: string,
  action: 'accept' | 'decline' | 'miss'
) {
  if (!isBrowser() || !callId || !userId) return false;

  const response = await authFetch('/api/group-call/respond', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callId, userId, action }),
  });

  return response.ok;
}

async function triggerCommentPush(payload: {
  postId: string;
  commenterName: string;
  commenterDeviceId: string;
  commenterUserId?: string | null;
  commentContent: string;
}) {
  if (!isBrowser()) return;
  try {
    // Look up the post author's device ID
    let postAuthorDeviceId = '';
    let postAuthorUserId: string | null = null;
    if (supabase) {
      const { data } = await supabase
        .from('charishub_posts')
        .select('author_device_id,guest_id,author_user_id')
        .eq('id', payload.postId)
        .maybeSingle();
      postAuthorDeviceId = data?.author_device_id || data?.guest_id || '';
      postAuthorUserId = data?.author_user_id || null;
    } else {
      // Local fallback
      const posts = readLocal<any[]>(LS_POSTS_KEY, []);
      const post = posts.find((p: any) => p.id === payload.postId);
      postAuthorDeviceId = post?.author_device_id || '';
      postAuthorUserId = post?.author_user_id || null;
    }

    if (!postAuthorDeviceId && !postAuthorUserId) return;
    
    // Don't notify self (check device or user)
    const isSelf = (postAuthorDeviceId === payload.commenterDeviceId) || 
                   (postAuthorUserId && payload.commenterUserId && postAuthorUserId === payload.commenterUserId);
                   
    if (isSelf) return;

    await authFetch('/api/push/comment-notification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        postId: payload.postId,
        postAuthorDeviceId,
        postAuthorUserId,
        commenterName: payload.commenterName,
        commenterDeviceId: payload.commenterDeviceId,
        commenterUserId: payload.commenterUserId || null,
        commentPreview: payload.commentContent,
      }),
    });
  } catch {
    // Ignore push errors to keep comment flow fast.
  }
}

export async function fetchGroupCallPresence(groupId: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('community_group_call_presence')
      .select('*')
      .eq('group_id', groupId)
      .gt('last_seen_at', new Date(Date.now() - 45000).toISOString()); // Actif si vu il y a moins de 45s
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchActiveGroupCall(groupId: string): Promise<GroupCallSession | null> {
  if (!groupId || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('charishub_group_calls')
      .select('*')
      .eq('group_id', cleanUuid(groupId))
      .in('status', ['ringing', 'active'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: String(data.id),
      group_id: String(data.group_id),
      room_id: String(data.room_id || ''),
      created_by: String(data.created_by || ''),
      status: (data.status as GroupCallSession['status']) || 'ringing',
      started_at: String(data.started_at || data.created_at || new Date().toISOString()),
      ended_at: data.ended_at ? String(data.ended_at) : null,
      created_at: String(data.created_at || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export async function fetchPosts(limit = 30, kind?: CommunityKind, groupId?: string | null) {
  if (!supabase) return localFetchPosts(limit, kind, groupId);

  let remotePosts: CommunityPost[] = [];
  try {
    const queryLimit = limit * 2;
    const cleanedGroupId = groupId ? cleanUuid(groupId) : null;
    let query = supabase
      .from('charishub_posts')
      .select('*')
      .order('created_at', { ascending: false });

    query = query.or('visibility.eq.public,visibility.is.null');
    if (kind && kind !== 'general') query = query.eq('kind', kind);

    if (cleanedGroupId) {
      query = query.eq('group_id', cleanedGroupId);
    } else {
      query = query.or('group_id.is.null,group_id.eq.""');
    }

    const { data, error } = await query.limit(limit);
    if (!error && data) {
      return (data ?? []).map(normalizePost);
    }

    // FALLBACK 1: Missing column 'media_type' or 'media_url' (Unified media fallback)
    if (isMissingColumnError(error, 'media_type') || isMissingColumnError(error, 'media_url')) {
      const { data: fallback, error: fbError } = await supabase
        .from('charishub_posts')
        .select(`
          id, created_at, updated_at, author_name, author_device_id, 
          user_id, content, group_id, likes_count, 
          comments_count, kind, visibility
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!fbError && fallback) {
        return (fallback ?? []).map(normalizePost);
      }

      // ULTIMATE FALLBACK: Very minimal set
      if (fbError) {
        const { data: minimal, error: minError } = await supabase
          .from('charishub_posts')
          .select(`id, created_at, author_name, content`)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!minError && minimal) return (minimal ?? []).map(normalizePost);
      }
    }

    // FALLBACK 2: Missing column 'visibility'
    if (isMissingColumnError(error, 'visibility')) {
      const fallback = await supabase
        .from('charishub_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      const normalized = (fallback.data ?? [])
        .filter(isPublicVisibilityRow)
        .map(normalizePost);
      const byGroup = groupId
        ? normalized.filter((item: CommunityPost) => item.group_id === groupId)
        : normalized.filter((item: CommunityPost) => !item.group_id);
      return (kind && kind !== 'general'
        ? byGroup.filter((item: CommunityPost) => item.kind === kind)
        : byGroup
      ).slice(0, Math.max(1, limit));
    }

    if (kind && kind !== 'general' && isMissingKindColumnError(error)) {
      const fallback = await supabase
        .from('charishub_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      const normalized = (fallback.data ?? [])
        .filter(isPublicVisibilityRow)
        .map(normalizePost);
      const cleanedGroupId = groupId ? cleanUuid(groupId) : null;
      const byGroup = cleanedGroupId
        ? normalized.filter((item: CommunityPost) => cleanUuid(item.group_id || '') === cleanedGroupId)
        : normalized.filter((item: CommunityPost) => !item.group_id);
      return byGroup.filter((item: CommunityPost) => item.kind === kind).slice(0, Math.max(1, limit));
    }

    if (groupId && isMissingColumnError(error, 'group_id')) {
      const fallback = await supabase
        .from('charishub_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      const cleanedGroupId = cleanUuid(groupId);
      return (fallback.data ?? [])
        .filter(isPublicVisibilityRow)
        .map(normalizePost)
        .filter((item: CommunityPost) => cleanUuid(item.group_id || '') === cleanedGroupId)
        .slice(0, Math.max(1, limit));
    }

    if (!groupId && isMissingColumnError(error, 'group_id')) {
      const fallback = await supabase
        .from('charishub_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(queryLimit);
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? [])
        .filter(isPublicVisibilityRow)
        .map(normalizePost)
        .filter((item: CommunityPost) => !item.group_id)
        .slice(0, Math.max(1, limit));
    }

    if (error) throw error;
    remotePosts = (data as any[] || []).filter((row: any) => isPublicVisibilityRow(row)).map(normalizePost);
  } catch (err) {
    logger.warn('[fetchPosts] Remote fetch failed, using local only:', err);
  }

  const localPosts = await localFetchPosts(limit, kind, groupId);
  const merged = [...remotePosts];
  const remoteIds = new Set(remotePosts.map((p: CommunityPost) => p.id));
  
  localPosts.forEach(lp => {
    if (!remoteIds.has(lp.id)) {
      merged.push(lp);
    }
  });

  return merged
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, limit);
}

export async function fetchPostById(postId: string) {
  if (!postId) return null;
  if (!supabase) return localFetchPostById(postId);

  try {
    let { data, error } = await supabase
      .from('charishub_posts')
      .select('*')
      .eq('id', postId)
      .eq('visibility', 'public')
      .maybeSingle();

    if (error && (
      isMissingColumnError(error, 'visibility') || 
      isMissingColumnError(error, 'media_type') || 
      isMissingColumnError(error, 'media_url')
    )) {
      const { data: fallback, error: fbError } = await supabase
        .from('charishub_posts')
        .select(`
          id, created_at, author_name, content, author_device_id
        `)
        .eq('id', postId)
        .maybeSingle();
      data = fallback;
      error = fbError;
    }
    if (error) throw error;
    if (data && !isPublicVisibilityRow(data)) return null;
    return data ? normalizePost(data) : null;
  } catch {
    return localFetchPostById(postId);
  }
}

export async function createPost(payload: {
  author_name: string;
  author_device_id: string;
  user_id: string; // Désormais obligatoire pour l'écriture
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  kind?: CommunityKind;
  group_id?: string | null;
}) {
  if (!payload.user_id) {
    throw new Error('Authentification requise pour publier.');
  }

  const cleanContent = payload.content?.trim() || '';
  
  if (payload.kind === 'announcement') {
    const canPublish = await canPublishAnnouncement();
    if (!canPublish) {
      throw new Error('Seuls les administrateurs peuvent publier des annonces.');
    }
  }

  if (!supabase) throw new Error('Service indisponible (Hors-ligne)');

  try {
    const insertPayload: Record<string, any> = {
      author_name: payload.author_name,
      author_device_id: payload.author_device_id, // On le garde pour compatibilité RLS legacy si besoin, mais user_id prime
      user_id: payload.user_id,
      content: cleanContent,
      media_url: payload.media_url || null,
      media_type: payload.media_type || null,
      kind: payload.kind || 'general',
      group_id: payload.group_id ? cleanUuid(payload.group_id) : null,
    };

    const { data, error } = await supabase
      .from('charishub_posts')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      logger.error('[createPost] Supabase Insert Error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    if (!data) throw new Error('Erreur lors de la création du post (aucune donnée retournée).');

    const created = normalizePost(data);
    void triggerCommunityPostPush(created, payload.author_device_id);
    return created;
  } catch (error: any) {
    logger.error('[createPost] Global Error:', error?.message || error);
    throw error;
  }
}

export async function updatePost(
  postId: string,
  userId: string, // Désormais obligatoire
  payload: {
    content?: string;
    media_url?: string | null;
    media_type?: string | null;
  }
) {
  if (!postId) throw new Error('Publication introuvable.');
  if (!userId) throw new Error('Authentification requise.');

  const cleanContent = payload.content?.trim();
  const updatePayload: Record<string, any> = {};
  if (typeof cleanContent === 'string') updatePayload.content = cleanContent;
  if (payload.media_url !== undefined) updatePayload.media_url = payload.media_url;
  if (payload.media_type !== undefined) updatePayload.media_type = payload.media_type;

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('Aucune modification détectée.');
  }

  if (!supabase) throw new Error('Service indisponible.');

  try {
    const { data, error } = await supabase
      .from('charishub_posts')
      .update(updatePayload)
      .eq('id', postId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Modification non autorisée ou post inexistant.');
    return normalizePost(data);
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la mise à jour du message.');
  }
}

export async function toggleLike(postId: string, deviceId: string) {
  if (!supabase) return localToggleLike(postId, deviceId);

  const applyLocalLikeState = (liked: boolean) => {
    const likes = loadLocalLikes();
    const current = new Set(likes[postId] ?? []);
    if (liked) current.add(deviceId);
    else current.delete(deviceId);
    likes[postId] = Array.from(current);
    saveLocalLikes(likes);
    return current;
  };

  if (likeStrategy === 'rpc') {
    try {
      const { data, error } = await supabase.rpc('toggle_like', {
        p_post_id: postId,
        p_device_id: deviceId,
      });
      if (error) throw error;
      const nextCount = Array.isArray(data) ? data[0]?.likes_count : data?.likes_count;
      if (typeof nextCount === 'number') {
        const likes = loadLocalLikes();
        const current = new Set(likes[postId] ?? []);
        const liked = nextCount > current.size;
        applyLocalLikeState(liked);
      }
      return Array.isArray(data) ? data[0] : data;
    } catch {
      likeStrategy = 'counter';
    }
  }

  if (likeStrategy === 'counter') {
    try {
      // Fallback if RPC toggle_like is missing or incompatible.
      // Try a direct likes_count update on the post row.
      const likes = loadLocalLikes();
      const current = new Set(likes[postId] ?? []);
      const likedBefore = current.has(deviceId);
      const likedAfter = !likedBefore;
      const delta = likedAfter ? 1 : -1;

      const currentRow = await supabase
        .from('charishub_posts')
        .select('likes_count')
        .eq('id', postId)
        .single();

      if (currentRow.error) throw currentRow.error;

      const base = Number(currentRow.data?.likes_count ?? 0);
      const nextCount = Math.max(0, base + delta);

      const updated = await supabase
        .from('charishub_posts')
        .update({ likes_count: nextCount })
        .eq('id', postId)
        .select('likes_count')
        .single();

      if (updated.error) throw updated.error;

      applyLocalLikeState(likedAfter);
      return { likes_count: Number(updated.data?.likes_count ?? nextCount) };
    } catch {
      likeStrategy = 'local';
    }
  }

  return localToggleLike(postId, deviceId);
}

export async function fetchComments(postId: string) {
  if (!supabase) return localFetchComments(postId);
  try {
    const query = supabase
      .from('charishub_comments')
      .select('*')
      .eq('post_id', cleanUuid(postId))
      .order('created_at', { ascending: true });

    const { data, error } = await query;
    if (error) {
      logger.warn('[fetchComments] error, falling back to local:', error.message);
      return localFetchComments(postId);
    }
    return (data || []).map(normalizeComment);
  } catch (error: any) {
    return localFetchComments(postId);
  }
}

export async function addComment(payload: {
  post_id: string;
  author_name: string;
  author_device_id: string;
  user_id: string; // Obligatoire
  content: string;
}) {
  if (!payload.user_id) throw new Error('Authentification requise pour commenter.');
  if (!supabase) throw new Error('Service indisponible.');

  try {
    const insertPayload = {
      post_id: payload.post_id,
      author_name: payload.author_name,
      author_device_id: payload.author_device_id,
      user_id: payload.user_id,
      content: payload.content,
    };

    const { data, error } = await supabase
      .from('charishub_comments')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de l’envoi du commentaire.');

    void triggerCommentPush({
      postId: payload.post_id,
      commenterName: payload.author_name,
      commenterDeviceId: payload.author_device_id,
      commenterUserId: payload.user_id,
      commentContent: payload.content,
    });
    
    return normalizeComment(data);
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de l’envoi du commentaire.');
  }
}

export async function reportPost(payload: {
  targetId: string;
  reason: CommunityReportReason;
  message?: string;
  reporterUserId?: string | null;
  reporterDeviceId?: string | null;
}) {
  if (!payload.targetId) {
    throw new Error('Publication introuvable.');
  }
  if (!supabase) {
    throw new Error('Signalement indisponible en mode hors-ligne.');
  }

  const normalizedReason = (() => {
    const value = String(payload.reason || 'other').toLowerCase();
    if (value === 'spam') return 'spam';
    if (value === 'harassment') return 'harassment';
    if (value === 'illegal') return 'illegal';
    return 'other';
  })();

  const variants: Array<Record<string, any>> = [
    {
      target_type: 'post',
      target_id: payload.targetId,
      reason: normalizedReason,
      message: payload.message || null,
      reporter_user_id: payload.reporterUserId || null,
      reporter_device_id: payload.reporterDeviceId || null,
      status: 'open',
    },
    {
      target_type: 'post',
      target_id: payload.targetId,
      reason: normalizedReason,
      message: payload.message || null,
      reporter_device_id: payload.reporterDeviceId || null,
      status: 'open',
    },
    {
      target_type: 'post',
      target_id: payload.targetId,
      reason: normalizedReason,
      message: payload.message || null,
      status: 'open',
    },
    {
      target_type: 'post',
      target_id: payload.targetId,
      reason: normalizedReason,
      message: payload.message || null,
    },
  ];

  let lastError: any = null;
  for (const variant of variants) {
    const attempt = await supabase.from('moderation_reports').insert(variant);
    if (!attempt.error) return { ok: true as const };
    lastError = attempt.error;
    if (isMissingTableError(attempt.error, 'moderation_reports')) {
      throw new Error('Signalements non configurés côté serveur.');
    }
    const expectedSchemaGap =
      ('reporter_user_id' in variant && isMissingColumnError(attempt.error, 'reporter_user_id')) ||
      ('reporter_device_id' in variant && isMissingColumnError(attempt.error, 'reporter_device_id')) ||
      ('status' in variant && isMissingColumnError(attempt.error, 'status')) ||
      ('message' in variant && isMissingColumnError(attempt.error, 'message'));
    if (!expectedSchemaGap) {
      throw attempt.error;
    }
  }

  throw new Error(lastError?.message || 'Erreur lors du signalement.');
}

export async function deletePost(postId: string, userId: string): Promise<DeletePostResult> {
  if (!supabase) throw new Error('Service indisponible.');
  if (!userId) throw new Error('Authentification requise.');

  const { error } = await supabase
    .from('charishub_posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId);

  if (error) {
    if (error.code === '23503') {
      // Suppression manuelle des dépendances si cascade non configurée
      await supabase.from('charishub_comments').delete().eq('post_id', postId);
      const retry = await supabase.from('charishub_posts').delete().eq('id', postId).eq('user_id', userId);
      if (retry.error) throw retry.error;
      return { ok: true };
    }
    throw error;
  }

  return { ok: true };
}

export async function createStory(payload: {
  author_name: string;
  author_device_id: string;
  user_id: string; // Obligatoire
  verse_reference: string;
  verse_text: string;
  image_data_url?: string;
  kind?: CommunityStoryKind;
  config?: CommunityStoryConfig;
}) {
  if (!payload.user_id) throw new Error('Authentification requise.');
  if (!supabase) throw new Error('Service indisponible.');

  try {
    let imageUrl: string | null = null;
    let autoImageDataUrl = payload.image_data_url || '';

    if (!autoImageDataUrl) {
      try {
        const refMatch = payload.verse_reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        const book = refMatch?.[1] || payload.verse_reference || 'Bible';
        const chapter = Number(refMatch?.[2] || 1);
        const verse = Number(refMatch?.[3] || 1);
        const generated = await renderVerseStoryPng(
          {
            version: 'LSG',
            book,
            bookAbbr: book.slice(0, 3).toUpperCase(),
            chapter: Number.isFinite(chapter) ? chapter : 1,
            verse: Number.isFinite(verse) ? verse : 1,
            text: payload.verse_text || '',
          },
          { theme: 'night', style: 'gradient' }
        );
        autoImageDataUrl = generated.dataUrl;
      } catch {
        autoImageDataUrl = createAutoStoryImageDataUrl(payload.verse_reference, payload.verse_text);
      }
    }

    if (autoImageDataUrl) {
      const fileName = `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      const filePath = `community-stories/${payload.user_id}/${fileName}`;
      try {
        let blob = dataUrlToBlob(autoImageDataUrl);
        if (!blob) {
          const response = await fetch(autoImageDataUrl);
          if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
          blob = await response.blob();
        }

        const { error: uploadError } = await supabase.storage
          .from('community-media')
          .upload(filePath, blob, {
            cacheControl: '3600',
            contentType: 'image/png',
            upsert: false,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from('community-media').getPublicUrl(filePath);
          imageUrl = data?.publicUrl || null;
        } else {
          imageUrl = autoImageDataUrl;
        }
      } catch {
        imageUrl = autoImageDataUrl;
      }
    }

    const insertPayload = {
      author_name: payload.author_name,
      author_device_id: payload.author_device_id,
      user_id: payload.user_id,
      verse_reference: payload.verse_reference,
      verse_text: payload.verse_text,
      image_url: imageUrl,
      kind: payload.kind || 'verse',
      config: payload.config || {},
    };

    const { data, error } = await supabase
      .from('community_stories')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la création de la story.');
  }
}

export async function deleteStory(storyId: string, deviceId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('community_stories')
    .delete()
    .eq('id', storyId)
    .eq('author_device_id', deviceId);
  if (error) throw error;
}

export async function fetchStories(limit = 40): Promise<CommunityStory[]> {
  if (!supabase) return localFetchStories(limit);
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('community_stories')
      .select('*')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CommunityStory[];
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors du chargement des stories.');
  }
}

export async function fetchGroups(limit = 40, deviceId?: string, userId?: string | null) {
  let remoteGroups: CommunityGroup[] = [];
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('charishub_groups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isMissingColumnError(error, 'call_link') || isMissingColumnError(error, 'call_provider') || isMissingColumnError(error, 'next_call_at')) {
          // Fallback selection of only known columns
          const fallbackResponse = await supabase
            .from('charishub_groups')
            .select('id, name, description, group_type, created_at, created_by_name, created_by_device_id')
            .order('created_at', { ascending: false })
            .limit(limit);
          if (!fallbackResponse.error) {
            remoteGroups = (fallbackResponse.data ?? []).map((row: any) => normalizeGroup(row));
          }
        } else if (isMissingTableError(error, 'charishub_groups')) {
          // No remote groups table yet
        } else {
          logger.error('[fetchGroups] Supabase error:', error);
        }
      } else {
        remoteGroups = (data ?? []).map((row: any) => normalizeGroup(row));
      }

      if (remoteGroups.length > 0 && deviceId) {
        const groupIds = remoteGroups.map((group) => group.id);
        let { data: membersData, error: membersError } = await supabase
          .from('charishub_group_members')
          .select('group_id, device_id, user_id, status')
          .in('group_id', groupIds);

        if (membersError && isMissingColumnError(membersError, 'status')) {
          const fallback = await supabase
            .from('charishub_group_members')
            .select('group_id, device_id')
            .in('group_id', groupIds);
          membersData = (fallback.data ?? []) as any[];
        }

        const membersByGroup = new Map<string, number>();
        const membershipStatusMap = new Map<string, 'approved' | 'pending'>();

        (membersData ?? []).forEach((m: { group_id: string; device_id: string; user_id?: string; status?: string }) => {
          const gId = m.group_id;
          const status = m.status || 'approved'; // Default to approved if status column doesn't exist yet
          
          if (status === 'approved') {
            membersByGroup.set(gId, (membersByGroup.get(gId) || 0) + 1);
          }
          
          if (
            (deviceId && m.device_id === deviceId) || 
            (userId && m.user_id === userId)
          ) {
            membershipStatusMap.set(gId, status as any);
          }
        });

        remoteGroups = remoteGroups.map((group) => {
          const status = membershipStatusMap.get(group.id);
          return {
            ...group,
            joined: status === 'approved',
            membershipStatus: (status as any) || null,
            members_count: membersByGroup.get(group.id) || group.members_count || 0
          };
        });
      }
    } catch (err) {
      logger.error('[fetchGroups] Remote fetch failed:', err);
    }
  }

  // Always merge with local groups to ensure visibility of groups created during network/schema issues
  const localGroups = await localFetchGroups(limit, deviceId);
  const localIds = new Set(localGroups.map(g => g.id));
  
  // Filter out remotes that are already in local (to avoid duplicates if something works partially)
  // Actually, usually remotes are preferred, but if they are the same ID, local might be more recent
  const merged = [...remoteGroups];
  localGroups.forEach(lg => {
    if (!merged.find(rg => rg.id === lg.id)) {
      merged.push(lg);
    }
  });

  return merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function fetchGroupMembers(groupId: string, limit = 80): Promise<CommunityGroupMember[]> {
  if (!groupId) return [];
  if (!supabase) return localFetchGroupMembers(groupId, limit);

  try {
    const ordered = await supabase
      .from('charishub_group_members')
      .select('group_id, device_id, display_name, joined_at, status')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })
      .limit(limit);

    let rows: any[] = ordered.data ?? [];
    let queryError = ordered.error;

    if (queryError) {
      if (isMissingColumnError(queryError, 'joined_at') || isMissingColumnError(queryError, 'status')) {
        const fallback = await supabase
          .from('charishub_group_members')
          .select('group_id, device_id, display_name')
          .eq('group_id', groupId)
          .limit(limit);
        rows = (fallback.data ?? []) as any[];
        queryError = fallback.error;
      }

      if (queryError) {
        if (isMissingTableError(queryError, 'charishub_group_members')) {
          return localFetchGroupMembers(groupId, limit);
        }
        if (isMissingColumnError(queryError, 'group_id')) {
          return [];
        }
        throw queryError;
      }
    }

    return rows.map((r) => normalizeGroupMember(r, groupId)).filter(Boolean) as CommunityGroupMember[];
  } catch {
    return localFetchGroupMembers(groupId, limit);
  }
}


export async function moderateGroupMember(
  groupId: string,
  memberUserId: string | null | undefined,
  memberDeviceId: string,
  action: 'approve' | 'reject'
) {
  if (!supabase) return;

  const session = (await supabase.auth.getSession()).data.session;
  const authId = session?.user?.id;
  if (!authId) throw new Error('Authentification requise pour modérer.');

  const filter = memberUserId 
    ? `user_id.eq.${memberUserId}` 
    : `device_id.eq.${memberDeviceId}`;

  if (action === 'reject') {
    await supabase.from('charishub_group_members')
      .delete()
      .eq('group_id', groupId)
      .or(filter);
    return;
  }

  await supabase
    .from('charishub_group_members')
    .update({ status: 'approved' })
    .eq('group_id', groupId)
    .or(filter);
}

export async function createGroup(payload: {
  name: string;
  description?: string;
  group_type?: CommunityGroupType;
  created_by_name?: string;
  created_by_device_id: string;
  call_provider?: CommunityCallProvider | null;
  call_link?: string | null;
  next_call_at?: string | null;
  is_paid?: boolean;
  price?: number;
  pass_code?: string;
  user_id: string;
}) {
  if (!payload.user_id) throw new Error('Authentification requise.');
  const name = (payload.name || '').trim();
  if (name.length < 3) throw new Error('Le nom du groupe doit contenir au moins 3 caractères.');

  const created_by_name = payload.created_by_name || 'Invite';

  if (!supabase) throw new Error('Service indisponible.');

  try {
    const insertPayload = {
      name,
      description: payload.description || '',
      group_type: payload.group_type || 'study',
      created_by_name,
      created_by_device_id: payload.created_by_device_id,
      user_id: payload.user_id,
      call_provider: payload.call_provider || null,
      call_link: payload.call_link || null,
      next_call_at: payload.next_call_at || null,
      is_paid: payload.is_paid || false,
      price: payload.price || 0,
      pass_code: payload.pass_code || '',
    };

    const { data, error } = await supabase
      .from('charishub_groups')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la création du groupe.');

    const group = normalizeGroup(data);

    // Auto-join
    await joinGroup(group.id, payload.created_by_device_id, created_by_name, payload.user_id);

    return group;
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la création du groupe.');
  }
}

export async function deleteGroup(groupId: string, userId: string, actorDeviceId?: string) {
  const cleanedId = cleanUuid(groupId);
  if (!cleanedId) throw new Error('Groupe introuvable.');

  if (!supabase) {
    return localDeleteGroup(cleanedId, actorDeviceId);
  }
  if (!userId) throw new Error('Authentification requise.');
  
  try {
    const response = await authFetch('/api/groups/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId: cleanedId }),
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    if (!response.ok || !body.ok) {
      throw new Error(body.error || 'Erreur lors de la suppression du groupe.');
    }

    return { ok: true };
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la suppression du groupe.');
  }
}

export async function joinGroup(groupId: string, deviceId: string, displayName: string, userId: string) {
  if (!groupId || !userId) throw new Error('Paramètres manquants pour rejoindre.');
  if (!supabase) throw new Error('Service indisponible.');

  const insertPayload = { 
    group_id: groupId, 
    device_id: deviceId, 
    user_id: userId, 
    display_name: displayName || 'Utilisateur', 
    status: 'approved' // Par défaut approuvé pour l'instant
  };

  const { error } = await supabase.from('charishub_group_members').insert(insertPayload);
  if (error) {
    if (error.code === '23505') return; // Déjà membre
    throw error;
  }
}

export async function leaveGroup(groupId: string, userId: string) {
  if (!groupId || !userId) return;
  if (!supabase) throw new Error('Service indisponible.');

  const { error } = await supabase
    .from('charishub_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateGroup(
  groupId: string,
  userId: string,
  payload: {
    call_provider?: CommunityCallProvider | null;
    call_link?: string | null;
    next_call_at?: string | null;
    description?: string;
    admin_ids?: string[];
    session_tasks?: string[];
  }
) {
  if (!groupId || !userId) return null;
  if (!supabase) throw new Error('Service indisponible.');

  const { data, error } = await supabase
    .from('charishub_groups')
    .update(payload)
    .eq('id', cleanUuid(groupId))
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data ? normalizeGroup(data) : null;
}

const CALL_EVENT_TYPES = new Set<CommunityGroupCallEventType>([
  'join',
  'leave',
  'mute',
  'unmute',
  'video_on',
  'video_off',
  'mode_audio',
  'mode_video',
  'error',
]);

export async function upsertGroupCallPresence(payload: {
  groupId: string;
  deviceId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  joinedAt?: string;
  sharedBibleRef?: string | null;
  sharedBibleContent?: string | null;
  prayerFlowOpen?: boolean;
  prayerFlowStepIndex?: number;
  userId?: string | null;
}) {
  if (!payload.groupId || !payload.deviceId) return false;
  if (isBrowser()) {
    try {
      const response = await authFetch('/api/group-call/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', ...payload }),
      });
      if (response.ok) return true;
    } catch {
      // Fallback to direct Supabase below when possible.
    }
  }
  if (!supabase) return false;

  const now = new Date().toISOString();
  const baseRow: Record<string, any> = {
    group_id: payload.groupId,
    device_id: payload.deviceId,
    guest_id: payload.deviceId,
    display_name: payload.displayName || 'Invite',
    audio_enabled: payload.audioEnabled,
    video_enabled: payload.videoEnabled,
    joined_at: payload.joinedAt || now,
    last_seen_at: now,
    shared_bible_ref: payload.sharedBibleRef,
    shared_bible_content: payload.sharedBibleContent,
    prayer_flow_open: !!payload.prayerFlowOpen,
    prayer_flow_step_index: payload.prayerFlowStepIndex || 0,
    user_id: payload.userId || null,
  };

  const variants: Array<{ row: Record<string, any>; onConflict: string }> = [
    { row: baseRow, onConflict: 'group_id,device_id' },
    {
      row: (() => {
        const clone = { ...baseRow };
        delete clone.guest_id;
        return clone;
      })(),
      onConflict: 'group_id,device_id',
    },
    {
      row: (() => {
        const clone = { ...baseRow };
        delete clone.device_id;
        return clone;
      })(),
      onConflict: 'group_id,guest_id',
    },
  ];

  for (const variant of variants) {
    const result = await supabase
      .from('community_group_call_presence')
      .upsert(variant.row, { onConflict: variant.onConflict });
    if (!result.error) return true;

    const missingExpectedColumn =
      ('device_id' in variant.row && isMissingColumnError(result.error, 'device_id')) ||
      ('guest_id' in variant.row && isMissingColumnError(result.error, 'guest_id')) ||
      ('display_name' in variant.row && isMissingColumnError(result.error, 'display_name')) ||
      ('audio_enabled' in variant.row && isMissingColumnError(result.error, 'audio_enabled')) ||
      ('video_enabled' in variant.row && isMissingColumnError(result.error, 'video_enabled')) ||
      ('joined_at' in variant.row && isMissingColumnError(result.error, 'joined_at')) ||
      ('last_seen_at' in variant.row && isMissingColumnError(result.error, 'last_seen_at'));
    const invalidConflict = String(result.error.code || '').toUpperCase() === '42P10';
    if (missingExpectedColumn || invalidConflict) continue;

    if (isMissingTableError(result.error, 'community_group_call_presence')) {
      logger.error('[communityApi] Table community_group_call_presence manquante dans Supabase.');
      return false;
    }
    logger.error('[communityApi] Erreur upsert de présence d\'appel:', result.error);
    return false;
  }

  return false;
}

export async function clearGroupCallPresence(groupId: string, deviceId: string) {
  if (!groupId || !deviceId || typeof groupId !== 'string' || typeof deviceId !== 'string') return false;
  if (isBrowser()) {
    try {
      const response = await authFetch('/api/group-call/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'clear', groupId, deviceId }),
      });
      if (response.ok) return true;
    } catch {
      // Fallback to direct Supabase below when possible.
    }
  }
  if (!supabase) return false;

  const variants = [
    { column: 'device_id', value: deviceId },
    { column: 'guest_id', value: deviceId },
  ];

  try {
    for (const variant of variants) {
      const result = await supabase
        .from('community_group_call_presence')
        .delete()
        .eq('group_id', groupId)
        .eq(variant.column, variant.value);
      
      if (!result.error) return true;
      
      if (isMissingColumnError(result.error, variant.column)) continue;
      
      // Known structural error
      if (isMissingTableError(result.error, 'community_group_call_presence')) {
        logger.warn('[CommunityAPI] Table de présence absente.');
        return false;
      }
    }
  } catch (err) {
    // Silence cleanup errors as they are non-critical during page navigation/closing
  }

  return false;
}

export async function logGroupCallEvent(payload: {
  groupId: string;
  deviceId: string;
  displayName: string;
  eventType: CommunityGroupCallEventType;
  details?: Record<string, unknown>;
  userId?: string | null;
}) {
  if (!payload.groupId || !payload.deviceId) return false;
  if (!CALL_EVENT_TYPES.has(payload.eventType)) return false;
  if (!supabase) return false;

  const row: Record<string, any> = {
    group_id: payload.groupId,
    device_id: payload.deviceId,
    guest_id: payload.deviceId,
    display_name: payload.displayName || 'Invite',
    event_type: payload.eventType,
    payload: payload.details || {},
    user_id: payload.userId || null,
  };

  const variants: Array<Record<string, any>> = [
    row,
    (() => {
      const clone = { ...row };
      delete clone.guest_id;
      return clone;
    })(),
  ];

  for (const variant of variants) {
    const result = await supabase.from('community_group_call_events').insert(variant);
    if (!result.error) return true;

    const missingExpectedColumn =
      ('device_id' in variant && isMissingColumnError(result.error, 'device_id')) ||
      ('guest_id' in variant && isMissingColumnError(result.error, 'guest_id')) ||
      ('display_name' in variant && isMissingColumnError(result.error, 'display_name')) ||
      ('event_type' in variant && isMissingColumnError(result.error, 'event_type')) ||
      ('payload' in variant && isMissingColumnError(result.error, 'payload'));
    if (missingExpectedColumn) continue;
    if (isMissingTableError(result.error, 'community_group_call_events')) {
      logger.error('[communityApi] Table community_group_call_events manquante dans Supabase.');
      return false;
    }
    logger.error('[communityApi] Erreur log d\'événement d\'appel:', result.error);
    return false;
  }

  return false;
}

export async function syncCommunityData() {
  // HARD DISABLED TO STOP INFINITE RECREATION
  return;
}
/**
 * CHALLENGES
 */

export async function fetchChallenges(groupId: string, actor?: { userId?: string | null; deviceId: string }): Promise<CommunityChallenge[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('charishub_challenges')
    .select(`
      *,
      participants_count:charishub_challenge_participants(count)
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch challenges:', error);
    return [];
  }

  const challenges = data.map((row: any) => ({
    ...row,
    participants_count: row.participants_count?.[0]?.count ?? 0
  }));

  if (actor) {
    const { data: myProgress } = await supabase
      .from('charishub_challenge_participants')
      .select('*')
      .in('challenge_id', challenges.map(c => c.id))
      .or(`user_id.eq.${actor.userId},device_id.eq.${actor.deviceId}`);
    
    if (myProgress) {
      challenges.forEach(c => {
        c.my_progress = myProgress.find(p => p.challenge_id === c.id) || null;
      });
    }
  }

  return challenges;
}

export async function createChallenge(payload: {
  group_id: string;
  title: string;
  description?: string;
  target_type: CommunityChallengeType;
  target_config: any;
  end_date?: string;
}) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('charishub_challenges')
    .insert({
      ...payload,
      created_by: userData.user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return data as CommunityChallenge;
}

export async function joinChallenge(challengeId: string, actor: { userId?: string | null; deviceId: string }) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase
    .from('charishub_challenge_participants')
    .insert({
      challenge_id: challengeId,
      user_id: actor.userId,
      device_id: actor.deviceId,
      progress: {},
      progress_percent: 0
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null; // Already joined
    throw error;
  }
  return data as CommunityChallengeParticipant;
}

export async function updateChallengeProgress(
  challengeId: string, 
  actor: { userId?: string | null; deviceId: string },
  progress: any,
  percent: number
) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase
    .from('charishub_challenge_participants')
    .update({
      progress,
      progress_percent: percent,
      updated_at: new Date().toISOString(),
      completed_at: percent >= 100 ? new Date().toISOString() : null
    })
    .or(`user_id.eq.${actor.userId},device_id.eq.${actor.deviceId}`)
    .eq('challenge_id', challengeId)
    .select()
    .single();

  if (error) throw error;
  return data as CommunityChallengeParticipant;
}

export async function fetchChallengeParticipants(challengeId: string): Promise<CommunityChallengeParticipant[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('charishub_challenge_participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('progress_percent', { ascending: false });

  if (error) {
    logger.error('Failed to fetch challenge participants:', error);
    return [];
  }

  return data;
}

export async function updateBibleReadingChallenges(actor: { userId?: string | null; deviceId: string }, bookId: string, chapter: number) {
  if (!supabase) return;

  // 1. Trouver les participations actives à des défis de lecture
  const { data: participations, error } = await supabase
    .from('charishub_challenge_participants')
    .select(`
      *,
      challenge:charishub_challenges!inner(*)
    `)
    .or(`user_id.eq.${actor.userId},device_id.eq.${actor.deviceId}`)
    .eq('challenge.target_type', 'bible_reading')
    .eq('challenge.status', 'active');

  if (error || !participations) return;

  for (const part of participations) {
    const config = part.challenge.target_config || {};
    // Si le défi est spécifique à un livre et que ce n'est pas celui-ci, on skip
    if (config.bookId && config.bookId !== bookId) continue;

    const progress = part.progress || {};
    const completedChapters = new Set(progress.completed_chapters || []);
    
    const chapterKey = `${bookId}_${chapter}`;
    if (!completedChapters.has(chapterKey)) {
      completedChapters.add(chapterKey);
      
      // Calcul du pourcentage (très basique pour l'instant)
      // Si on a une liste de chapitres cibles
      let percent = part.progress_percent || 0;
      if (config.total_chapters) {
        percent = Math.min(100, Math.round((completedChapters.size / config.total_chapters) * 100));
      } else {
        // Progression incrémentale par chapitre (ex: 5% par chapitre lu)
        percent = Math.min(100, (part.progress_percent || 0) + 5);
      }

      await updateChallengeProgress(part.challenge_id, actor, {
        ...progress,
        completed_chapters: Array.from(completedChapters)
      }, percent);
      
      logger.info(`Challenge progress updated: ${part.challenge.title} (${percent}%)`);
    }
  }
}
