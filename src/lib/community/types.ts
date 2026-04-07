/**
 * Types partagés pour l'API communautaire CharisHub.
 */

export type CommunityKind = 'general' | 'prayer' | 'help' | 'announcement' | 'content';

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

export type CommunityStoryKind = 'verse' | 'text' | 'image';
export type CommunityStoryConfig = {
  background?: string;
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
  admin_ids?: string[];
  is_paid?: boolean;
  price?: number;
  pass_code?: string;
  session_tasks?: string[];
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

export type DeletePostResult = { ok: true };

export type LocalLikeMap = Record<string, string[]>;
export type LocalGroupMember = {
  device_id: string;
  display_name: string;
  joined_at: string;
  status: CommunityGroupMemberStatus;
};
export type LocalGroupMembersMap = Record<string, LocalGroupMember[]>;
