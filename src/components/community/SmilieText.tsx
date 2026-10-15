import { renderSmilies, smilieUrl } from '../../config/smilieRegistry';
import { extractYouTubeSegments, InlineYouTubePlayer } from './YouTubeEmbed';

interface SmilieTextProps {
  text: string;
  className?: string;
  smilieSize?: number;
  /** When true, YouTube URLs are rendered as inline click-to-play embeds. */
  enableYouTube?: boolean;
}

export function SmilieText({ text, className, smilieSize = 20, enableYouTube = false }: SmilieTextProps) {
  // First split out YouTube URLs, then render smilies inside each text segment.
  const youTubeSegments = enableYouTube ? extractYouTubeSegments(text) : [{ type: 'text' as const, content: text }];

  return (
    <span className={className}>
      {youTubeSegments.map((seg, si) => {
        if (seg.type === 'youtube' && enableYouTube && seg.videoId) {
          return <InlineYouTubePlayer key={`yt-${si}`} videoId={seg.videoId} />;
        }
        const parts = renderSmilies(seg.content);
        return parts.map((part, pi) => {
          if (part.type === 'text') {
            return <span key={`${si}-${pi}`}>{part.content}</span>;
          }
          const url = smilieUrl(part.code!);
          if (!url) return <span key={`${si}-${pi}`}>:{part.code}:</span>;
          return (
            <img
              key={`${si}-${pi}`}
              src={url}
              alt={`:${part.code}:`}
              title={`:${part.code}:`}
              style={{ height: smilieSize, width: 'auto', display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}
              loading="lazy"
            />
          );
        });
      })}
    </span>
  );
}
