import { VideoMetadata, YouTubeService } from './youtubeService';
import { supabase } from '../shared/supabase/client';
import type { Companion } from './companionService';

interface PlannedReaction {
  timestamp: number;
  reaction: string;
  sent: boolean;
}

export class VideoReactionService {
  private reactions: Map<string, PlannedReaction[]> = new Map();

  async planReactions(
    watchedVideoId: string,
    companion: Companion,
    videoMetadata: VideoMetadata,
    videoDurationSeconds: number
  ): Promise<PlannedReaction[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        return this.getDefaultReactions(videoDurationSeconds);
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video-reaction`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'plan',
          companion,
          videoMetadata,
          videoDurationSeconds
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate reactions');
      }

      const data = await response.json();
      const content = data.content?.[0];

      if (content?.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const reactions = JSON.parse(jsonMatch[0]);
      const plannedReactions: PlannedReaction[] = reactions.map((r: any) => ({
        timestamp: r.timestamp,
        reaction: r.reaction,
        sent: false,
      }));

      this.reactions.set(watchedVideoId, plannedReactions);
      return plannedReactions;
    } catch (error) {
      console.error('Error planning reactions:', error);
      return this.getDefaultReactions(videoDurationSeconds);
    }
  }

  private getDefaultReactions(duration: number): PlannedReaction[] {
    return [
      { timestamp: 10, reaction: "let's see what this is about", sent: false },
      { timestamp: Math.floor(duration * 0.3), reaction: 'interesting!', sent: false },
      { timestamp: Math.floor(duration * 0.7), reaction: 'this is cool', sent: false },
    ];
  }

  checkForReaction(
    watchedVideoId: string,
    currentTime: number
  ): PlannedReaction | null {
    const reactions = this.reactions.get(watchedVideoId);
    if (!reactions) return null;

    for (const reaction of reactions) {
      if (!reaction.sent && currentTime >= reaction.timestamp && currentTime <= reaction.timestamp + 2) {
        reaction.sent = true;
        return reaction;
      }
    }

    return null;
  }

  async generateEndOfVideoReaction(
    companion: Companion,
    videoMetadata: VideoMetadata
  ): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        return "that was fun! 😊";
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video-reaction`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'end',
          companion,
          videoMetadata
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate end reaction');
      }

      const data = await response.json();
      const content = data.content?.[0];

      if (content?.type === 'text') {
        return content.text.trim();
      }
    } catch (error) {
      console.error('Error generating end reaction:', error);
    }

    return "that was fun! 😊";
  }

  async saveReaction(
    watchedVideoId: string,
    companionId: string,
    timestamp: number,
    reactionText: string,
    reactionType: 'proactive' | 'response' | 'end_of_video'
  ): Promise<void> {
    await YouTubeService.saveVideoReaction(
      watchedVideoId,
      companionId,
      timestamp,
      reactionText,
      reactionType
    );
  }

  clearReactions(watchedVideoId: string): void {
    this.reactions.delete(watchedVideoId);
  }
}

export const videoReactionService = new VideoReactionService();
