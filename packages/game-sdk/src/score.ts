import type { ScoreTracker, Storage } from './types';

export function createScoreTracker(storage: Storage, key = 'highscore'): ScoreTracker {
  let score = 0;
  let high = storage.get<number>(key, 0);
  return {
    get score() {
      return score;
    },
    get highScore() {
      return high;
    },
    add(points) {
      score += points;
    },
    set(points) {
      score = points;
    },
    reset() {
      score = 0;
    },
    commitHighScore() {
      if (score > high) {
        high = score;
        storage.set(key, high);
        return true;
      }
      return false;
    },
  };
}
