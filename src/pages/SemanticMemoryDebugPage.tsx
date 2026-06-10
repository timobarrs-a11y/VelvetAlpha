import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Database, Brain, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { SemanticMemoryService } from '../services/semanticMemoryService';
import { MemoryService, RelationshipMemory } from '../services/memoryService';
import { supabase } from '../shared/supabase/client';

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  duration?: number;
}

export default function SemanticMemoryDebugPage() {
  const navigate = useNavigate();
  const [testQuery, setTestQuery] = useState('Tell me about my job');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [memories, setMemories] = useState<RelationshipMemory[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const testResults: TestResult[] = [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      testResults.push({
        test: 'Authentication',
        status: 'error',
        message: 'Not logged in',
      });
      setResults(testResults);
      setIsRunning(false);
      return;
    }

    setUserId(user.id);

    testResults.push({
      test: 'Authentication',
      status: 'success',
      message: `Logged in as ${user.email}`,
    });

    const testEmbedding = async () => {
      const start = Date.now();
      try {
        const embedding = await SemanticMemoryService.generateEmbedding('test query');
        const duration = Date.now() - start;

        const isZeroVector = embedding.every(v => v === 0);

        if (isZeroVector) {
          return {
            test: 'Embedding Generation',
            status: 'warning' as const,
            message: 'Returning zero vectors (OpenAI API key not configured)',
            details: {
              dimensions: embedding.length,
              duration: `${duration}ms`,
              note: 'System will fall back to keyword search'
            },
            duration,
          };
        }

        return {
          test: 'Embedding Generation',
          status: 'success' as const,
          message: 'Embeddings generating correctly',
          details: {
            dimensions: embedding.length,
            sampleValues: embedding.slice(0, 5).map(v => v.toFixed(4)),
            duration: `${duration}ms`
          },
          duration,
        };
      } catch (error: any) {
        return {
          test: 'Embedding Generation',
          status: 'error' as const,
          message: 'Failed to generate embedding',
          details: error.message,
          duration: Date.now() - start,
        };
      }
    };

    testResults.push(await testEmbedding());

    const checkMemoriesExist = async () => {
      const start = Date.now();
      try {
        const { data, error } = await supabase
          .from('relationship_memories')
          .select('*')
          .eq('user_id', user.id)
          .limit(10);

        if (error) throw error;

        setMemories(data || []);

        return {
          test: 'Memory Storage',
          status: data && data.length > 0 ? 'success' as const : 'warning' as const,
          message: data && data.length > 0
            ? `Found ${data.length} memories in database`
            : 'No memories stored yet',
          details: {
            count: data?.length || 0,
            types: data?.reduce((acc: any, m: any) => {
              acc[m.memory_type] = (acc[m.memory_type] || 0) + 1;
              return acc;
            }, {}),
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          test: 'Memory Storage',
          status: 'error' as const,
          message: 'Failed to query memories',
          details: error.message,
          duration: Date.now() - start,
        };
      }
    };

    testResults.push(await checkMemoriesExist());

    const testSemanticSearch = async () => {
      const start = Date.now();
      try {
        const results = await SemanticMemoryService.searchSemanticMemories(
          user.id,
          testQuery,
          5,
          0.65
        );

        const duration = Date.now() - start;

        if (results.length === 0) {
          return {
            test: 'Semantic Search',
            status: 'warning' as const,
            message: 'No semantic matches found',
            details: {
              query: testQuery,
              threshold: 0.65,
              duration: `${duration}ms`,
              note: 'Will fall back to keyword search'
            },
            duration,
          };
        }

        return {
          test: 'Semantic Search',
          status: 'success' as const,
          message: `Found ${results.length} matches`,
          details: {
            query: testQuery,
            matches: results.map(r => ({
              similarity: r.similarity.toFixed(3),
              content: r.memory.content.substring(0, 60) + '...',
              type: r.memory.memory_type,
            })),
            duration: `${duration}ms`,
          },
          duration,
        };
      } catch (error: any) {
        return {
          test: 'Semantic Search',
          status: 'error' as const,
          message: 'Search failed',
          details: error.message,
          duration: Date.now() - start,
        };
      }
    };

    testResults.push(await testSemanticSearch());

    const testKeywordFallback = async () => {
      const start = Date.now();
      try {
        const results = await MemoryService.getRelevantMemories(
          user.id,
          testQuery,
          5
        );

        return {
          test: 'Keyword Fallback',
          status: 'success' as const,
          message: results.length > 0
            ? `Keyword search found ${results.length} matches`
            : 'Keyword search ready (no matches for query)',
          details: {
            query: testQuery,
            matchCount: results.length,
            duration: `${Date.now() - start}ms`,
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          test: 'Keyword Fallback',
          status: 'error' as const,
          message: 'Keyword search failed',
          details: error.message,
          duration: Date.now() - start,
        };
      }
    };

    testResults.push(await testKeywordFallback());

    const testRPCFunction = async () => {
      const start = Date.now();
      try {
        const testVector = new Array(1536).fill(0.1);
        const { data, error } = await supabase.rpc('search_memories_by_similarity', {
          query_embedding: testVector,
          query_user_id: user.id,
          match_threshold: 0.5,
          match_count: 5,
        });

        if (error) throw error;

        return {
          test: 'RPC Function',
          status: 'success' as const,
          message: 'Database function accessible',
          details: {
            function: 'search_memories_by_similarity',
            resultCount: data?.length || 0,
            duration: `${Date.now() - start}ms`,
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          test: 'RPC Function',
          status: 'error' as const,
          message: 'Database function error',
          details: error.message,
          duration: Date.now() - start,
        };
      }
    };

    testResults.push(await testRPCFunction());

    setResults(testResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: 'success' | 'error' | 'warning') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: 'success' | 'error' | 'warning') => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-3xl font-bold text-white">Semantic Memory Diagnostics</h1>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-6 h-6 text-purple-300" />
            <h2 className="text-xl font-bold text-white">Test Query</h2>
          </div>
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 mb-4"
            placeholder="Enter a test query..."
          />
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Running Diagnostics...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Run Full Diagnostic
              </>
            )}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4 mb-6">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-6 border-2 ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{result.test}</h3>
                      {result.duration && (
                        <span className="text-sm text-slate-600">{result.duration}ms</span>
                      )}
                    </div>
                    <p className="text-slate-700 mb-2">{result.message}</p>
                    {result.details && (
                      <pre className="bg-white/50 p-3 rounded text-xs overflow-auto max-h-40 text-slate-800">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {memories.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-6 h-6 text-blue-300" />
              <h2 className="text-xl font-bold text-white">Your Stored Memories</h2>
            </div>
            <div className="space-y-3">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-white/10 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold text-purple-300 uppercase">
                      {memory.memory_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-white/60">
                      Score: {memory.importance_score}
                    </span>
                  </div>
                  <p className="text-white text-sm mb-2">{memory.content}</p>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className="px-2 py-1 bg-white/10 rounded">
                      {memory.emotional_valence}
                    </span>
                    <span>Referenced {memory.reference_count}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 bg-blue-900/30 border border-blue-400/50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-300 mb-3">How to Interpret Results</h3>
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p><strong className="text-green-300">Success:</strong> Component working correctly</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p><strong className="text-yellow-300">Warning:</strong> Using fallback (app still works)</p>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p><strong className="text-red-300">Error:</strong> Component not functioning</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm text-white/70">
              <strong>Note:</strong> If embeddings show "zero vectors", semantic search is disabled but
              the app will work fine using keyword-based memory search instead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
