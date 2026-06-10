import { supabase } from '../shared/supabase/client';

export interface MemoryCluster {
  id: string;
  user_id: string;
  cluster_theme: string;
  cluster_summary: string;
  memory_ids: string[];
  emotional_tone: string | null;
  importance_score: number;
  created_at: string;
  updated_at: string;
}

export interface TemporalChain {
  id: string;
  user_id: string;
  chain_topic: string;
  memory_sequence: string[];
  narrative_summary: string | null;
  start_date: string;
  last_updated: string;
  is_active: boolean;
  created_at: string;
}

export interface SemanticMemoryResult {
  memory: any;
  similarity: number;
  cluster?: MemoryCluster;
  chain?: TemporalChain;
}

export class SemanticMemoryService {
  /**
   * Generate embedding vector for text using OpenAI's embeddings API
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Call edge function to generate embedding
      const { data, error } = await supabase.functions.invoke('generate-embedding', {
        body: { text },
      });

      if (error) throw error;
      return data.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Search memories using semantic similarity
   */
  static async searchSemanticMemories(
    userId: string,
    queryText: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SemanticMemoryResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Use pgvector's cosine similarity search
      const { data, error } = await supabase.rpc('search_memories_by_similarity', {
        query_embedding: queryEmbedding,
        query_user_id: userId,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        console.error('Semantic search error:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        memory: item,
        similarity: item.similarity,
      }));
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Create or update memory clusters based on semantic similarity
   */
  static async clusterMemories(userId: string): Promise<MemoryCluster[]> {
    try {
      // Get all memories with embeddings
      const { data: memories, error } = await supabase
        .from('relationship_memories')
        .select('*')
        .eq('user_id', userId)
        .not('embedding', 'is', null);

      if (error || !memories || memories.length === 0) return [];

      // Simple clustering: group memories with high similarity
      const clusters: Map<string, any[]> = new Map();
      const processed = new Set<string>();

      for (const memory of memories) {
        if (processed.has(memory.id)) continue;

        const cluster: any[] = [memory];
        processed.add(memory.id);

        // Find similar memories
        for (const other of memories) {
          if (processed.has(other.id)) continue;

          const similarity = this.cosineSimilarity(memory.embedding, other.embedding);
          if (similarity > 0.75) {
            cluster.push(other);
            processed.add(other.id);
          }
        }

        if (cluster.length > 1) {
          const theme = this.extractClusterTheme(cluster);
          clusters.set(theme, cluster);
        }
      }

      // Save clusters to database
      const savedClusters: MemoryCluster[] = [];
      for (const [theme, clusterMemories] of clusters.entries()) {
        const summary = this.generateClusterSummary(clusterMemories);
        const emotionalTone = this.detectClusterEmotion(clusterMemories);

        const { data, error } = await supabase
          .from('memory_clusters')
          .upsert({
            user_id: userId,
            cluster_theme: theme,
            cluster_summary: summary,
            memory_ids: clusterMemories.map(m => m.id),
            emotional_tone: emotionalTone,
            importance_score: Math.max(...clusterMemories.map(m => m.importance_score)),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          savedClusters.push(data);
        }
      }

      return savedClusters;
    } catch (error) {
      console.error('Error clustering memories:', error);
      return [];
    }
  }

  /**
   * Build temporal chains - sequences of related events
   */
  static async buildTemporalChains(userId: string): Promise<TemporalChain[]> {
    try {
      const { data: memories, error } = await supabase
        .from('relationship_memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !memories || memories.length < 2) return [];

      const chains: Map<string, any[]> = new Map();

      // Look for memories that reference previous events
      for (let i = 1; i < memories.length; i++) {
        const current = memories[i];
        const content = current.content.toLowerCase();

        // Detect temporal references
        const hasTemporalRef = [
          'yesterday', 'last week', 'last month', 'before', 'after',
          'then', 'now', 'finally', 'update:', 'remember when',
          'like i said', 'still', 'again'
        ].some(ref => content.includes(ref));

        if (hasTemporalRef) {
          // Find semantically related previous memories
          const queryEmbedding = current.embedding;
          if (!queryEmbedding) continue;

          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            const previous = memories[j];
            if (!previous.embedding) continue;

            const similarity = this.cosineSimilarity(queryEmbedding, previous.embedding);
            if (similarity > 0.7) {
              // Found a chain
              const topic = this.extractChainTopic(previous, current);
              const existingChain = chains.get(topic);

              if (existingChain) {
                existingChain.push(current);
              } else {
                chains.set(topic, [previous, current]);
              }
              break;
            }
          }
        }
      }

      // Save chains to database
      const savedChains: TemporalChain[] = [];
      for (const [topic, chainMemories] of chains.entries()) {
        const narrative = this.generateNarrativeSummary(chainMemories);

        const { data, error } = await supabase
          .from('temporal_chains')
          .upsert({
            user_id: userId,
            chain_topic: topic,
            memory_sequence: chainMemories.map(m => m.id),
            narrative_summary: narrative,
            start_date: chainMemories[0].created_at,
            last_updated: new Date().toISOString(),
            is_active: this.isChainActive(chainMemories),
          })
          .select()
          .single();

        if (!error && data) {
          savedChains.push(data);
        }
      }

      return savedChains;
    } catch (error) {
      console.error('Error building temporal chains:', error);
      return [];
    }
  }

  /**
   * Get enriched context with clusters and chains
   */
  static async getEnrichedContext(
    userId: string,
    currentMessage: string,
    limit: number = 10
  ): Promise<string> {
    try {
      // Get semantically similar memories
      const results = await this.searchSemanticMemories(userId, currentMessage, limit);

      if (results.length === 0) return '';

      // Get active temporal chains
      const { data: chains } = await supabase
        .from('temporal_chains')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_updated', { ascending: false })
        .limit(3);

      // Get relevant clusters
      const memoryIds = results.map(r => r.memory.id);
      const { data: clusters } = await supabase
        .from('memory_clusters')
        .select('*')
        .eq('user_id', userId)
        .filter('memory_ids', 'ov', memoryIds);

      let context = '\n\n🧠 SEMANTIC MEMORY CONTEXT (Deep Understanding):';

      // Add narrative chains if relevant
      if (chains && chains.length > 0) {
        context += '\n\n📖 ONGOING STORIES:\n';
        for (const chain of chains) {
          context += `• ${chain.chain_topic}: ${chain.narrative_summary}\n`;
        }
      }

      // Add clustered memories by theme
      if (clusters && clusters.length > 0) {
        context += '\n\n🎯 KEY THEMES:\n';
        for (const cluster of clusters) {
          context += `• ${cluster.cluster_theme} (${cluster.emotional_tone || 'neutral'}): ${cluster.cluster_summary}\n`;
        }
      }

      // Add most relevant individual memories
      context += '\n\n💭 MOST RELEVANT MEMORIES:\n';
      const topMemories = results.slice(0, 5);
      for (const result of topMemories) {
        const similarity = Math.round(result.similarity * 100);
        context += `• [${similarity}% match] ${result.memory.content}\n`;
      }

      context += '\n\nUSE THIS CONTEXT to show deep understanding. Connect current conversation to past patterns and ongoing storylines.';

      return context;
    } catch (error) {
      console.error('Error getting enriched context:', error);
      return '';
    }
  }

  // Helper methods

  private static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }

  private static extractClusterTheme(memories: any[]): string {
    // Extract most common tags
    const tagCounts: Map<string, number> = new Map();
    for (const memory of memories) {
      for (const tag of memory.context_tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([tag]) => tag);

    return sortedTags.join(' + ') || 'General';
  }

  private static generateClusterSummary(memories: any[]): string {
    const types = memories.map(m => m.memory_type);
    const contents = memories.map(m => m.content.substring(0, 50)).join('; ');
    return `${types[0]} cluster with ${memories.length} related memories: ${contents}...`;
  }

  private static detectClusterEmotion(memories: any[]): string {
    const emotions = memories.map(m => m.emotional_valence);
    const positiveCount = emotions.filter(e => e === 'positive').length;
    const negativeCount = emotions.filter(e => e === 'negative').length;

    if (positiveCount > negativeCount * 2) return 'positive';
    if (negativeCount > positiveCount * 2) return 'negative';
    return 'mixed';
  }

  private static extractChainTopic(first: any, second: any): string {
    const tags1 = new Set(first.context_tags || []);
    const tags2 = new Set(second.context_tags || []);
    const common = Array.from(tags1).filter(t => tags2.has(t));
    return common[0] || first.memory_type;
  }

  private static generateNarrativeSummary(memories: any[]): string {
    if (memories.length === 2) {
      return `First: ${memories[0].content.substring(0, 40)}... Then: ${memories[1].content.substring(0, 40)}...`;
    }
    return `${memories.length}-part story from ${memories[0].created_at.split('T')[0]} to ${memories[memories.length - 1].created_at.split('T')[0]}`;
  }

  private static isChainActive(memories: any[]): boolean {
    const lastMemory = memories[memories.length - 1];
    const daysSince = (Date.now() - new Date(lastMemory.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  }
}
