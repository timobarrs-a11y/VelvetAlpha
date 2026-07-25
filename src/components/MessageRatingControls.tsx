import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, RotateCcw, X } from 'lucide-react';
import { RatingValue, upsertRating, clearRating } from '../services/ratingService';

interface MessageRatingControlsProps {
  messageId: string;
  conversationId: string;
  companionId: string;
  currentRating?: RatingValue | null;
  onRated: (rating: RatingValue | null) => void;
  onRegenerate?: () => void;
}

const QUICK_REASONS = [
  'Too repetitive',
  'Felt robotic',
  'Didn\u2019t answer my question',
  'Used pet names too much',
  'Too long',
  'Off-topic',
];

export function MessageRatingControls({
  messageId,
  conversationId,
  companionId,
  currentRating,
  onRated,
  onRegenerate,
}: MessageRatingControlsProps) {
  const [showDislikePopup, setShowDislikePopup] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLike = async () => {
    if (currentRating === 'like') {
      setSubmitting(true);
      try {
        await clearRating(messageId);
        onRated(null);
      } catch { /* ignore */ } finally {
        setSubmitting(false);
      }
      return;
    }
    setSubmitting(true);
    try {
      await upsertRating({ messageId, conversationId, companionId, rating: 'like' });
      onRated('like');
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  const handleDislikeClick = () => {
    if (currentRating === 'dislike') {
      setShowDislikePopup(true);
      return;
    }
    setShowDislikePopup(true);
  };

  const submitDislike = async (reason: string) => {
    setSubmitting(true);
    try {
      await upsertRating({
        messageId,
        conversationId,
        companionId,
        rating: 'dislike',
        reason: reason.trim() || undefined,
      });
      onRated('dislike');
      setShowDislikePopup(false);
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  const removeDislike = async () => {
    setSubmitting(true);
    try {
      await clearRating(messageId);
      onRated(null);
      setShowDislikePopup(false);
      setReasonText('');
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={handleLike}
          disabled={submitting}
          title="Good response"
          className={`p-1.5 rounded-lg transition-all duration-150 ${
            currentRating === 'like'
              ? 'bg-emerald-100 text-emerald-600'
              : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDislikeClick}
          disabled={submitting}
          title="Bad response"
          className={`p-1.5 rounded-lg transition-all duration-150 ${
            currentRating === 'dislike'
              ? 'bg-rose-100 text-rose-600'
              : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'
          }`}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
        {currentRating === 'dislike' && onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={submitting}
            title="Try again"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all duration-150"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDislikePopup && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full mb-2 left-0 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">What went wrong?</p>
              <button
                onClick={() => setShowDislikePopup(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => submitDislike(r)}
                  disabled={submitting}
                  className="px-2.5 py-1 text-xs rounded-full bg-gray-100 hover:bg-rose-100 hover:text-rose-700 text-gray-600 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Describe the issue in your own words..."
              rows={2}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => submitDislike(reasonText)}
                disabled={submitting || !reasonText.trim()}
                className="flex-1 px-3 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                {submitting ? 'Saving...' : 'Submit'}
              </button>
              {currentRating === 'dislike' && (
                <button
                  onClick={removeDislike}
                  disabled={submitting}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-xl transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
