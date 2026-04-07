/**
 * Barrel file — Re-exports all community API modules.
 *
 * Usage: import { fetchGroups, CommunityGroup } from '@/lib/community';
 *
 * The legacy import path `@/components/communityApi` still works
 * because that file re-exports everything from this barrel.
 */

// Types
export * from './types';

// Utilities (helpers, normalizers, local storage, media upload, admin check)
export * from './utils';
