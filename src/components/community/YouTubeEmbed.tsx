import { useState } from 'react';
import { YouTubeService } from '../../services/youtubeService';
import { Play, Youtube, ExternalLink } from 'lucide-react';

/**
 * Extracts YouTube URLs from text and returns segments so the caller can
 * interleave them with the rest of the post body (smilies, plain text, etc).
 */
export interface TextSegment {
  type: 'text' | 'youtube';
  content: string; // raw text OR the full matched URL
  videoId?: string;
}

const YOUTUBE_REGEX =
  /(https?:\/\/)?(www\.)?(youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

export function extractYouTubeSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  YOUTUBE_REGEX.lastIndex = 0;
  while ((match = YOUTUBE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const fullUrl = match[0];
    const videoId = YouTubeService.extractVideoId(fullUrl) ?? match[4];
    segments.push({ type: 'youtube', content: fullUrl, videoId });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

/** Quick check — does this text contain at least one YouTube URL? */
export function hasYouTubeUrl(text: string): boolean {
  YOUTUBE_REGEX.lastIndex = 0;
  return YOUTUBE_REGEX.test(text);
}

/** Return the first YouTube video id found in the text, if any. */
export function firstYouTubeVideoId(text: string): string | null {
  YOUTUBE_REGEX.lastIndex = 0;
  const m = YOUTUBE_REGEX.exec(text);
  if (!m) return null;
  return YouTubeService.extractVideoId(m[0]) ?? m[4];
}

/**
 * Inline player shown inside a post body on the detail page.
 * Click-to-play: shows a thumbnail + play button, then swaps to the iframe.
 */
export function InlineYouTubePlayer({ videoId }: { videoId: string }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (playing) {
    return (
      <div className="relative pt-[56.25%] rounded-xl overflow-hidden border border-white/10 bg-black my-3">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&origin=${window.location.origin}`}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          title="YouTube video player"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="relative block w-full pt-[56.25%] rounded-xl overflow-hidden border border-white/10 bg-black my-3 group"
    >
      <img
        src={thumb}
        alt="YouTube video thumbnail"
        className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-80"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-red-600/90 group-hover:bg-red-500 transition-colors shadow-lg">
          <Play className="w-5 h-5 text-white fill-white" />
          <span className="text-white text-sm font-semibold">Play video</span>
        </div>
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
        <Youtube className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[10px] text-white/80 font-medium">YouTube</span>
      </div>
    </button>
  );
}

/**
 * Compact thumbnail card shown on post list cards. Clicking navigates to the
 * post detail where the full player lives.
 */
export function YouTubeCardThumbnail({
  videoId,
  onClick,
}: {
  videoId: string;
  onClick: () => void;
}) {
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="relative block w-full mt-2 rounded-lg overflow-hidden border border-white/10 group"
    >
      <div className="relative pt-[52%]">
        <img
          src={thumb}
          alt="YouTube video thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600/90 group-hover:bg-red-500 group-hover:scale-110 transition-all shadow-lg">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
        <div className="absolute bottom-1.5 left-2 flex items-center gap-1">
          <Youtube className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[10px] text-white/90 font-medium">Watch</span>
        </div>
        <div className="absolute bottom-1.5 right-2">
          <ExternalLink className="w-3 h-3 text-white/50" />
        </div>
      </div>
    </button>
  );
}
