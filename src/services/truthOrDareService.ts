import { getRandomTruth, getRandomDare } from '../data/truthOrDareContent';
import type { SubscriptionTier } from '../types/subscription';

interface GameStats {
  usedTruthIds: string[];
  usedDareIds: string[];
  totalTruths: number;
  totalDares: number;
  lastPlayed: number;
}

export class TruthOrDareService {
  private static STORAGE_KEY = 'truthOrDareStats';

  static getStats(): GameStats {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      usedTruthIds: [],
      usedDareIds: [],
      totalTruths: 0,
      totalDares: 0,
      lastPlayed: 0
    };
  }

  private static saveStats(stats: GameStats) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
  }

  static getTruth(tier: SubscriptionTier) {
    const stats = this.getStats();
    let truth = getRandomTruth(tier, stats.usedTruthIds);

    if (!truth) {
      stats.usedTruthIds = [];
      truth = getRandomTruth(tier, []);
    }

    if (truth) {
      stats.usedTruthIds.push(truth.id);
      stats.totalTruths++;
      stats.lastPlayed = Date.now();
      this.saveStats(stats);
    }

    return truth;
  }

  static getDare(tier: SubscriptionTier) {
    const stats = this.getStats();
    let dare = getRandomDare(tier, stats.usedDareIds);

    if (!dare) {
      stats.usedDareIds = [];
      dare = getRandomDare(tier, []);
    }

    if (dare) {
      stats.usedDareIds.push(dare.id);
      stats.totalDares++;
      stats.lastPlayed = Date.now();
      this.saveStats(stats);
    }

    return dare;
  }

  static shouldSuggestGame(messageCount: number): boolean {
    const stats = this.getStats();
    const hoursSinceLastPlayed = (Date.now() - stats.lastPlayed) / (1000 * 60 * 60);
    const currentHour = new Date().getHours();
    const isEveningTime = currentHour >= 19 && currentHour <= 23;

    const enoughMessages = messageCount >= 20;
    const enoughTimePassed = hoursSinceLastPlayed >= 2 || stats.lastPlayed === 0;
    const baseChance = Math.random() < 0.25;
    const eveningBoost = isEveningTime ? Math.random() < 0.4 : false;

    return enoughMessages && enoughTimePassed && (baseChance || eveningBoost);
  }
}
