import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Newspaper, ChevronRight } from 'lucide-react';
import { supabase } from '../shared/supabase/client';

interface SourceCardArticle {
  id: string;
  title: string;
  source?: string;
  image_url?: string | null;
}

interface SourceCardProps {
  articleIds: string[];
}

export function SourceCard({ articleIds }: SourceCardProps) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<SourceCardArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchArticles() {
      if (!articleIds.length) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('news_articles')
          .select('id, title, source, image_url')
          .in('id', articleIds)
          .limit(3);

        if (cancelled) return;
        if (!error && data) {
          setArticles(data);
        }
      } catch {
        // best-effort fetch
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchArticles();
    return () => { cancelled = true; };
  }, [articleIds]);

  if (loading) return null;
  if (!articles.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-2 space-y-2"
    >
      <div className="flex items-center gap-1.5 px-1">
        <Newspaper className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {articles.length === 1 ? 'Source' : 'Sources'}
        </span>
      </div>
      {articles.map((article) => (
        <motion.button
          key={article.id}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => navigate(`/article/${article.id}`)}
          className="group flex items-center gap-3 w-full text-left p-2.5 rounded-xl border border-gray-200/80 bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200"
        >
          {article.image_url ? (
            <img
              src={article.image_url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Newspaper className="w-5 h-5 text-gray-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {article.source && (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
                {article.source}
              </span>
            )}
            <p className="text-xs font-medium text-gray-700 leading-snug line-clamp-2">
              {article.title}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-gray-400 transition-colors" />
        </motion.button>
      ))}
    </motion.div>
  );
}
