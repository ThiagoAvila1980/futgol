import { describe, it, expect } from 'vitest';

describe('Gamification - Level Calculation', () => {
  const levelThresholds = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300];

  function calculateLevel(xp: number): number {
    const level = levelThresholds.findIndex(t => xp < t);
    return level === -1 ? levelThresholds.length : level;
  }

  function calculateXP(matchesPlayed: number, mvpCount: number, badges: number): number {
    return matchesPlayed * 10 + mvpCount * 25 + badges * 15;
  }

  it('should start at level 1 with 0 XP', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('should be level 1 with 5+ XP', () => {
    expect(calculateLevel(5)).toBe(2);
  });

  it('should calculate XP from stats correctly', () => {
    const xp = calculateXP(10, 2, 3);
    expect(xp).toBe(10 * 10 + 2 * 25 + 3 * 15);
    expect(xp).toBe(195);
  });

  it('should cap at max level', () => {
    expect(calculateLevel(999)).toBe(levelThresholds.length);
  });

  it('should progress through levels', () => {
    const levels = [0, 5, 15, 30, 50, 100, 200, 300].map(calculateLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });
});
