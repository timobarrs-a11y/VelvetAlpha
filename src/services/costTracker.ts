interface CostStats {
  date: string;
  cacheHits: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheMissTokens: number;
  cheapModelCalls: number;
  premiumModelCalls: number;
  totalMessages: number;
  totalCost: number;
}

const STORAGE_KEY = 'cost_tracker_stats';

export class CostTracker {
  private static getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private static getStats(): CostStats {
    const today = this.getTodayString();
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const stats: CostStats = JSON.parse(stored);
      if (stats.date === today) {
        return stats;
      }
    }

    const newStats: CostStats = {
      date: today,
      cacheHits: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheMissTokens: 0,
      cheapModelCalls: 0,
      premiumModelCalls: 0,
      totalMessages: 0,
      totalCost: 0,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
    return newStats;
  }

  private static saveStats(stats: CostStats): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  static trackCacheUsage(cacheReadTokens: number, cacheCreationTokens: number): void {
    const stats = this.getStats();
    stats.cacheReadTokens += cacheReadTokens;
    stats.cacheCreationTokens += cacheCreationTokens;
    if (cacheReadTokens > 0) {
      stats.cacheHits++;
    }
    this.saveStats(stats);
  }

  static trackApiCall(modelType: 'cheap' | 'premium', cost: number): void {
    const stats = this.getStats();

    if (modelType === 'cheap') {
      stats.cheapModelCalls++;
    } else {
      stats.premiumModelCalls++;
    }

    stats.totalMessages++;
    stats.totalCost += cost;
    this.saveStats(stats);
  }

  static logStats(): void {
  }

  static getSummary(): {
    totalMessages: number;
    cacheHits: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    cacheMissTokens: number;
    cheapModelCalls: number;
    premiumModelCalls: number;
    totalCost: number;
    savings: number;
    cacheHitRate: number;
  } {
    const stats = this.getStats();
    const totalApiCalls = stats.cheapModelCalls + stats.premiumModelCalls;
    const potentialCostAllPremium = totalApiCalls * 0.015;
    const savings = potentialCostAllPremium - stats.totalCost;
    const cacheHitRate = stats.totalMessages > 0
      ? (stats.cacheHits / stats.totalMessages) * 100
      : 0;

    return {
      totalMessages: stats.totalMessages,
      cacheHits: stats.cacheHits,
      cacheReadTokens: stats.cacheReadTokens,
      cacheCreationTokens: stats.cacheCreationTokens,
      cacheMissTokens: stats.cacheMissTokens,
      cheapModelCalls: stats.cheapModelCalls,
      premiumModelCalls: stats.premiumModelCalls,
      totalCost: stats.totalCost,
      savings,
      cacheHitRate,
    };
  }

  static resetStats(): void {
    const newStats: CostStats = {
      date: this.getTodayString(),
      cacheHits: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheMissTokens: 0,
      cheapModelCalls: 0,
      premiumModelCalls: 0,
      totalMessages: 0,
      totalCost: 0,
    };
    this.saveStats(newStats);
  }
}
