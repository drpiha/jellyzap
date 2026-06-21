export const GA_ID = import.meta.env.PUBLIC_GA4_ID ?? '';
export const ANALYTICS_ENABLED = GA_ID.length > 0;

/** Event taxonomy shared between the game host hooks and the page-level tracker. */
export const EVENTS = {
  GAME_START: 'game_start',
  GAME_OVER: 'game_over',
  LEVEL_UP: 'level_up',
  REWARD_REQUESTED: 'reward_requested',
  REWARD_GRANTED: 'reward_granted',
  AD_SHOWN: 'ad_shown',
  LANGUAGE_CHANGE: 'language_change',
  ADD_TO_HOME: 'add_to_home',
} as const;
