export const GAME_SOUNDS_DIR = "/game_sounds";

export const GAME_SOUND_FILES = {
  correct: "correct_answer.mp3",
  wrong: "wrong_answers.mp3",
  sessionEnd: "sessionend.mp3",
  startSession: "start_session.mp3",
  tap: "tap.mp3",
  levelUp: "level_up.mp3",
  coinSpend: "coin_spend.mp3",
  confirm: "confirm.mp3",
} as const;

export const HOME_MUSIC_FILES = [
  "home_music_1.mp3",
  "home_music_2.mp3",
  "home_music_3.mp3",
];

export const HOME_MUSIC_VOLUME = 0.35;

export type GameSoundKind = keyof typeof GAME_SOUND_FILES;

export const GAME_SOUND_LABELS: Record<GameSoundKind, string> = {
  tap: "Tap",
  correct: "Correct answer",
  wrong: "Wrong answer",
  startSession: "Start session",
  sessionEnd: "Session end",
  levelUp: "Level up",
  coinSpend: "Coin spend",
  confirm: "Confirm",
};

export function gameSoundUrl(filename: string) {
  const name = filename.replace(/^\/+/, "").replace(/^game_sounds\//, "");
  return `${GAME_SOUNDS_DIR}/${name}`;
}

export const GAME_SOUND_URLS = {
  correct: gameSoundUrl(GAME_SOUND_FILES.correct),
  wrong: gameSoundUrl(GAME_SOUND_FILES.wrong),
  sessionEnd: gameSoundUrl(GAME_SOUND_FILES.sessionEnd),
  startSession: gameSoundUrl(GAME_SOUND_FILES.startSession),
  tap: gameSoundUrl(GAME_SOUND_FILES.tap),
  levelUp: gameSoundUrl(GAME_SOUND_FILES.levelUp),
  coinSpend: gameSoundUrl(GAME_SOUND_FILES.coinSpend),
  confirm: gameSoundUrl(GAME_SOUND_FILES.confirm),
} as const;
