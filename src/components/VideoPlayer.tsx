import { useEffect, useState } from 'react';

interface VideoPlayerProps {
  videoId: string;
  onClose?: () => void;
  onPlay?: () => void;
  onTimeUpdate?: (currentTime: number) => Promise<void>;
  onEnded?: () => Promise<void>;
}

export function VideoPlayer({
  videoId,
  onPlay,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    onPlay?.();
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [videoId, onPlay]);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  return (
    <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden shadow-2xl">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&origin=${window.location.origin}`}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        title="YouTube video player"
        onError={handleError}
      />

      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-400 mx-auto mb-3"></div>
            <div className="text-white text-sm font-medium">Loading video...</div>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center text-white px-4">
            <div className="text-red-400 text-lg font-semibold mb-2">Unable to load video</div>
            <div className="text-gray-400 text-sm">The video player encountered an error</div>
          </div>
        </div>
      )}
    </div>
  );
}
