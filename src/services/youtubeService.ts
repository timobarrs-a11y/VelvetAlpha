import { supabase } from '../shared/supabase/client';

export interface VideoMetadata {
  videoId: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
}

export interface VideoTranscript {
  text: string;
  start: number;
  duration: number;
}

export class YouTubeService {
  static extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  static isYouTubeUrl(text: string): boolean {
    return /(?:youtube\.com|youtu\.be)/.test(text) || /^[a-zA-Z0-9_-]{11}$/.test(text.trim());
  }

  static async fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch video metadata');
      }

      const data = await response.json();

      return {
        videoId,
        title: data.title,
        description: data.author_name,
        thumbnail: data.thumbnail_url,
      };
    } catch (_error) {
      return {
        videoId,
        title: 'YouTube Video',
        description: 'Video information unavailable',
      };
    }
  }

  static async saveWatchedVideo(
    userId: string,
    companionId: string,
    videoUrl: string,
    metadata: VideoMetadata
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('watched_videos')
        .insert({
          user_id: userId,
          companion_id: companionId,
          video_url: videoUrl,
          video_id: metadata.videoId,
          video_title: metadata.title,
          video_description: metadata.description,
          video_duration: metadata.duration,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error saving watched video:', error);
        return null;
      }

      return data?.id || null;
    } catch (_error) {
      console.error('Error saving watched video:', error);
      return null;
    }
  }

  static async saveVideoReaction(
    watchedVideoId: string,
    companionId: string,
    timestampSeconds: number,
    reactionText: string,
    reactionType: 'proactive' | 'response' | 'end_of_video'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('video_reactions')
        .insert({
          watched_video_id: watchedVideoId,
          companion_id: companionId,
          timestamp_seconds: timestampSeconds,
          reaction_text: reactionText,
          reaction_type: reactionType,
        });

      if (error) {
        console.error('Error saving video reaction:', error);
        return false;
      }

      return true;
    } catch (_error) {
      console.error('Error saving video reaction:', error);
      return false;
    }
  }

  static async markVideoCompleted(watchedVideoId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('watched_videos')
        .update({ completed: true })
        .eq('id', watchedVideoId);

      if (error) {
        console.error('Error marking video as completed:', error);
        return false;
      }

      return true;
    } catch (_error) {
      console.error('Error marking video as completed:', error);
      return false;
    }
  }

  static async getWatchedVideos(userId: string, companionId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('watched_videos')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .order('watched_at', { ascending: false });

      if (error) {
        console.error('Error fetching watched videos:', error);
        return [];
      }

      return data || [];
    } catch (_error) {
      console.error('Error fetching watched videos:', error);
      return [];
    }
  }

  static generateEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
  }
}
