interface CostStats {
  date: string;
  cacheHits: number;
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

  static trackCacheHit(): void {
    const stats = this.getStats();
    stats.cacheHits++;
    stats.totalMessages++;
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
    const stats = this.getStats();
    const totalApiCalls = stats.cheapModelCalls + stats.premiumModelCalls;
    const avgCostPerApiCall = totalApiCalls > 0 ? stats.totalCost / totalApiCalls : 0;
    const cacheHitRate = stats.totalMessages > 0
      ? ((stats.cacheHits / stats.totalMessages) * 100).toFixed(1)
      : '0.0';

    const potentialCostAllPremium = totalApiCalls * 0.015;
    const savingsVsAllPremium = potentialCostAllPremium - stats.totalCost;
    const savingsPercentage = potentialCostAllPremium > 0
      ? ((savingsVsAllPremium / potentialCostAllPremium) * 100).toFixed(1)
      : '0.0';

    console.log('\n💰 ===== COST TRACKER STATS (Today) =====');
    console.log(`📅 Date: ${stats.date}`);
    console.log(`📨 Total Messages: ${stats.totalMessages}`);
    console.log(`✅ Cache Hits: ${stats.cacheHits} (${cacheHitRate}%)`);
    console.log(`🤖 AI Model Calls:`);
    console.log(`   💚 Cheap Model: ${stats.cheapModelCalls}`);
    console.log(`   💎 Premium Model: ${stats.premiumModelCalls}`);
    console.log(`   📊 Total API Calls: ${totalApiCalls}`);
    console.log(`💵 Actual Cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`💸 If All Premium: $${potentialCostAllPremium.toFixed(4)}`);
    console.log(`🎉 Savings: $${savingsVsAllPremium.toFixed(4)} (${savingsPercentage}%)`);
    console.log(`📈 Avg Cost/API Call: $${avgCostPerApiCall.toFixed(4)}`);
    console.log('=========================================\n');
  }

  static getSummary(): {
    totalMessages: number;
    cacheHits: number;
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
      cheapModelCalls: 0,
      premiumModelCalls: 0,
      totalMessages: 0,
      totalCost: 0,
    };
    this.saveStats(newStats);
    console.log('📊 Cost tracker stats reset');
  }
}
