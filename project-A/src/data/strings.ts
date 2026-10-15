/**
 * Centralized UI & announcer strings (language-ready localization structure).
 */

export const STRINGS = {
  en: {
    gameTitle: 'NEON TEMPEST',
    gameSubtitle: 'NEO-KYOTO UNDERGROUND TOURNAMENT // 2099',
    pressStart: 'PRESS ENTER OR START TO INITIALIZE',
    menus: {
      arcade: 'ARCADE CIRCUIT',
      arcadeDesc: 'Battle through the 4-stage Neo-Kyoto underground ladder.',
      versusCpu: 'VERSUS // P1 VS CPU',
      versusCpuDesc: 'Single battle against an archetype-driven AI opponent.',
      versus2p: 'VERSUS // LOCAL 2P',
      versus2pDesc: 'Head-to-head local showdown on Keyboard or Gamepads.',
      training: 'TRAINING LAB',
      trainingDesc: 'Frame data telemetry, hitbox overlays, dummy recording & playback.',
      trials: 'COMBO TRIALS',
      trialsDesc: 'Master 12 character-specific tactical combo challenges.',
      replay: 'REPLAY THEATER',
      replayDesc: 'Watch deterministic input-stream playback of the last match.',
      movelist: 'COMMAND ARCHIVE',
      movelistDesc: 'Inspect full move lists, motion icons, and system mechanics.',
      settings: 'SYSTEM CONFIG',
      settingsDesc: 'Customize controls, audio levels, accessibility, and display.'
    },
    hud: {
      overdriveReady: 'OVERDRIVE READY [HP+HK]',
      ultimateReady: 'ULTIMATE READY [236236+PP]',
      stunLabel: 'NEURAL STUN',
      meterLabel: 'TEMPEST GAUGE',
      hits: 'HITS',
      damage: 'DMG'
    }
  }
};

export type LocaleKey = keyof typeof STRINGS;
export const T = STRINGS.en;
