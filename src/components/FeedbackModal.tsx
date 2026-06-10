import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { ModalShell, Input, Textarea, Button } from '../shared/ui';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim().length < 10) {
      setError('Please provide more details (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user?.id || null,
          email: email || null,
          feedback_type: feedbackType,
          message: message.trim(),
          page_url: window.location.href,
          status: 'new'
        });

      if (insertError) throw insertError;

      setSubmitSuccess(true);
      setTimeout(() => {
        onClose();
        setSubmitSuccess(false);
        setMessage('');
        setEmail('');
        setFeedbackType('feature');
      }, 2000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={submitSuccess ? undefined : "Send Feedback"}
      size="md"
    >
      {submitSuccess ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600 w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600">Your feedback has been submitted successfully.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback Type
            </label>
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-50 transition-all duration-200 text-[15px]"
            >
              <option value="feature">Feature Request</option>
              <option value="bug">Bug Report</option>
              <option value="improvement">Improvement Suggestion</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            label="Email (optional for response)"
          />

          <div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={5}
              required
              label="Message"
              error={error}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              {message.length} characters (minimum 10)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || message.trim().length < 10}
              isLoading={isSubmitting}
              fullWidth
            >
              <Send className="w-4 h-4" />
              Send Feedback
            </Button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
