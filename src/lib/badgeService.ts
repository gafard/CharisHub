import { supabase } from './supabase';
import { BADGE_CATALOG, type Badge } from './badges';

export async function getEarnedBadges(userId?: string, deviceId?: string) {
  if (!supabase) return [];
  
  let query = supabase.from('user_badges').select('badge_id, awarded_at, metadata');
  
  if (userId) {
    query = query.eq('user_id', userId);
  } else if (deviceId) {
    query = query.eq('device_id', deviceId).is('user_id', null);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching badges:', error);
    return [];
  }
  return data;
}

export async function checkAndAwardBadge(
  action: 'streak' | 'reading' | 'pepites' | 'community',
  currentValue: number,
  context: { userId?: string; deviceId?: string }
) {
  if (!supabase) return null;

  const relevantBadges = BADGE_CATALOG.filter(b => b.category === (action === 'pepites' ? 'pépites' : action));
  const earnedBadges = await getEarnedBadges(context.userId, context.deviceId);
  const earnedIds = new Set(earnedBadges.map(b => b.badge_id));

  for (const badge of relevantBadges) {
    if (currentValue >= badge.threshold && !earnedIds.has(badge.id)) {
      // Award the badge
      const { data, error } = await supabase.from('user_badges').insert({
        user_id: context.userId || null,
        device_id: context.deviceId || null,
        badge_id: badge.id,
        metadata: { valueAtAward: currentValue }
      }).select().single();

      if (!error) {
        return badge; // Return the newly awarded badge to trigger UI notification
      }
    }
  }
  return null;
}
