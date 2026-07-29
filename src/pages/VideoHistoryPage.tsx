import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Youtube, Play, Search, Sparkles, X, Loader2, TrendingUp, Heart, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoPreferencesModal } from '../components/VideoPreferencesModal';

interface SearchedVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
}

async function getActiveTags(userId: string): Promise<string[]> {
  const [companionResult, prefsResult] = await Promise.all([
    supabase
      .from('companions')
      .select('hobbies, sports, sports_interests, entertainment_interests, tech_interests, lifestyle_interests, music_genre, interest_text, zodiac_sign')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_video_preferences')
      .select('custom_tags, disabled_tags')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const c = companionResult.data;
  const p = prefsResult.data;
  const disabled = new Set<string>(p?.disabled_tags || []);

  const questionnaire: string[] = [
    ...(c?.hobbies || []),
    ...(c?.sports || []),
    ...(c?.sports_interests || []),
    ...(c?.entertainment_interests || []),
    ...(c?.tech_interests || []),
    ...(c?.lifestyle_interests || []),
    c?.music_genre,
    c?.interest_text,
    c?.zodiac_sign,
  ].filter(Boolean) as string[];

  const custom: string[] = (p?.custom_tags || []);

  const all = [...questionnaire, ...custom].filter(t => !disabled.has(t));
  return [...new Set(all)];
}

export function VideoHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'interest-based' | 'search'>('interest-based');
  const [interestBasedVideos, setInterestBasedVideos] = useState<SearchedVideo[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [activeTagCount, setActiveTagCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const loadInterestBasedVideos = useCallback(async () => {
    setLoadingInterests(true);
    setInterestError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tags = await getActiveTags(user.id);
      setActiveTagCount(tags.length);

      if (tags.length === 0) {
        setInterestError('no-interests');
        return;
      }

      const shuffled = [...tags].sort(() => Math.random() - 0.5);
      const query = shuffled.slice(0, 3).join(' ');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-video-search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            userContext: 'User prefers content matching their personal interests and hobbies',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setInterestBasedVideos(data.videos || []);
    } catch (error) {
      console.error('Error loading interest-based videos:', error);
      setInterestError('fetch-failed');
    } finally {
      setLoadingInterests(false);
    }
  }, []);

  useEffect(() => {
    loadInterestBasedVideos();

    const videoUrl = searchParams.get('url');
    if (videoUrl) {
      const videoId = extractVideoId(videoUrl);
      if (videoId) {
        setSelectedVideo(videoId);
        setShowPlayer(true);
      }
    }
  }, [searchParams, loadInterestBasedVideos]);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const { data: { session, user } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-video-search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            userContext: 'User prefers educational, insightful content over viral/clickbait videos',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Search failed with status ${response.status}`);
      }

      const data = await response.json();
      const results = data.videos || [];
      setSearchResults(results);

      if (user) {
        supabase.from('video_search_history').insert({
          user_id: user.id,
          search_query: searchQuery,
          results_count: results.length,
        }).then(() => {});
      }
    } catch (error) {
      console.error('Error searching videos:', error);
      let errorMessage = 'Search failed. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message.includes('YouTube API key not configured')
          ? 'YouTube API key not configured. Contact support.'
          : error.message;
      }
      setSearchError(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const handleVideoClick = async (videoId: string) => {
    setSelectedVideo(videoId);
    setShowPlayer(true);

    if (searchQuery.trim()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('video_search_history').insert({
            user_id: user.id,
            search_query: searchQuery,
            results_count: searchResults.length,
            video_clicked: videoId,
          });
        }
      } catch {
        /* non-critical */
      }
    }
  };

  const renderVideoGrid = (videos: SearchedVideo[], showTopPick = false) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {videos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
          className="group bg-white/[0.03] border border-white/8 hover:border-red-400/40 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-red-900/10 hover:-translate-y-0.5"
          onClick={() => handleVideoClick(video.id)}
        >
          <div className="relative h-44 bg-black overflow-hidden">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                <Play className="w-6 h-6 text-white ml-1" />
              </div>
            </div>
            {showTopPick && index === 0 && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Top Pick
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-white mb-1.5 line-clamp-2 group-hover:text-red-400 transition-colors leading-snug">
              {video.title}
            </h3>
            <p className="text-xs text-white/40 mb-3 line-clamp-1">{video.channelTitle}</p>
            {video.viewCount && (
              <div className="flex items-center gap-1.5 text-xs text-white/30 pt-2.5 border-t border-white/6">
                <TrendingUp className="w-3 h-3" />
                <span>{parseInt(video.viewCount).toLocaleString()} views</span>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <div className="sticky top-0 z-30 bg-[#080810]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/lobby')}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </button>
            <Youtube className="w-5 h-5 text-red-400" />
            <span className="font-bold text-white text-lg tracking-tight">Your Lens</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('interest-based')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'interest-based'
                  ? 'bg-white text-black'
                  : 'bg-white/8 text-white/50 hover:text-white hover:bg-white/12'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              For You
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'search'
                  ? 'bg-white text-black'
                  : 'bg-white/8 text-white/50 hover:text-white hover:bg-white/12'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Smart Search
            </button>
            <button
              onClick={() => setShowPreferences(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-white/8 text-white/50 hover:text-white hover:bg-white/12 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Preferences
              {activeTagCount > 0 && (
                <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeTagCount > 9 ? '9+' : activeTagCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'interest-based' && (
            <motion.div
              key="interest-based"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {loadingInterests ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                  <Loader2 className="w-10 h-10 text-red-400 animate-spin" />
                  <p className="text-white/50 text-sm">Finding videos based on your interests...</p>
                </div>
              ) : interestError ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                    <Heart className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    {interestError === 'no-interests' ? 'No Active Interests' : 'Could Not Load Videos'}
                  </h2>
                  <p className="text-white/40 text-sm max-w-sm">
                    {interestError === 'no-interests'
                      ? 'Complete your questionnaire or add custom topics in Preferences to start your feed.'
                      : 'Something went wrong fetching your feed. Try refreshing.'}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    {interestError === 'no-interests' && (
                      <button
                        onClick={() => setShowPreferences(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        Open Preferences
                      </button>
                    )}
                    {interestError === 'fetch-failed' && (
                      <button
                        onClick={loadInterestBasedVideos}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                      </button>
                    )}
                  </div>
                </div>
              ) : interestBasedVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
                    <Youtube className="w-8 h-8 text-white/30" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Nothing Found</h2>
                  <p className="text-white/40 text-sm max-w-sm">No videos matched your interests this time. Try refreshing for a different selection.</p>
                  <button
                    onClick={loadInterestBasedVideos}
                    className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-white/40 text-sm">
                      Curated from <span className="text-white/60 font-medium">{activeTagCount} interest{activeTagCount !== 1 ? 's' : ''}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPreferences(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/6 hover:bg-white/10 text-white/50 hover:text-white text-xs font-medium rounded-lg transition-all"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={loadInterestBasedVideos}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/6 hover:bg-white/10 text-white/50 hover:text-white text-xs font-medium rounded-lg transition-all"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    </div>
                  </div>
                  {renderVideoGrid(interestBasedVideos)}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                <label className="text-sm font-semibold text-white/70 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-red-400" />
                  Smart Search
                </label>
                <p className="text-xs text-white/30 mb-4">
                  Search with a word or phrase. AI finds the most relevant, quality content.
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !searching && handleSmartSearch()}
                    placeholder="Try: meditation, cooking, jazz..."
                    className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-red-400/60 transition-colors text-sm"
                  />
                  <button
                    onClick={handleSmartSearch}
                    disabled={!searchQuery.trim() || searching}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-white/8 disabled:text-white/20 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    {searching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Search
                      </>
                    )}
                  </button>
                </div>
              </div>

              {searchError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3"
                >
                  <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm flex-1">{searchError}</p>
                  <button onClick={() => setSearchError(null)} className="text-red-400/60 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {searchResults.length > 0 && renderVideoGrid(searchResults, true)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showPlayer && selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPlayer(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowPlayer(false)}
                className="absolute -top-11 right-0 p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <VideoPlayer videoId={selectedVideo} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPreferences && (
          <VideoPreferencesModal
            onClose={() => setShowPreferences(false)}
            onSaved={loadInterestBasedVideos}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
