import { supabase } from './supabase';
import { BADGE_CATALOG, type Badge } from './badges';
import logger from './logger';

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
    logger.error('[badgeService] getEarnedBadges:', error);
    return [];
  }
  return data;
}

export async function checkAndAwardBadges(
  action: 'streak' | 'reading' | 'pepites' | 'community',
  currentValue: number,
  context: { userId?: string; deviceId?: string }
): Promise<Badge[]> {
  if (!supabase) return [];

  const category = action === 'pepites' ? 'pépites' : action;
  const relevantBadges = BADGE_CATALOG.filter(b => b.category === category);
  const earnedBadges = await getEarnedBadges(context.userId, context.deviceId);
  const earnedIds = new Set(earnedBadges.map(b => b.badge_id));

  const toAward = relevantBadges.filter(b => currentValue >= b.threshold && !earnedIds.has(b.id));
  if (toAward.length === 0) return [];

  const { error } = await supabase.from('user_badges').insert(
    toAward.map(b => ({
      user_id: context.userId ?? null,
      device_id: context.deviceId ?? null,
      badge_id: b.id,
      metadata: { valueAtAward: currentValue },
    }))
  );

  if (error) {
    logger.error('[badgeService] checkAndAwardBadges insert:', error);
    return [];
  }

  return toAward;
}

/** Alias rétrocompatible — retourne le premier badge débloqué ou null */
export async function checkAndAwardBadge(
  action: 'streak' | 'reading' | 'pepites' | 'community',
  currentValue: number,
  context: { userId?: string; deviceId?: string }
): Promise<Badge | null> {
  const awarded = await checkAndAwardBadges(action, currentValue, context);
  return awarded[0] ?? null;
}
