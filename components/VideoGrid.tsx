import React from 'react';
import { VideoData, ScrubCache } from '../types';
import { VideoCard } from './VideoCard';

interface VideoGridProps {
  videos: VideoData[];
  onUpdate: (video: VideoData) => void;
  allTags: string[];
  isMuted: boolean;
  onMuteChange: (isMuted: boolean) => void;
  volume: number;
  onVolumeChange: (newVolume: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  highlightedVideoId: string | null;
  getVideoFile: (video: VideoData) => Promise<File | null>;
  onRegenerate: (video: VideoData) => Promise<void>;
  currentlyPlayingVideoId: string | null;
  onSetPlayingVideoId: React.Dispatch<React.SetStateAction<string | null>>;
  scrubCache: ScrubCache;
  isLowMemoryMode: boolean;
  preloadThumbnails: boolean;
  gridSize: number;
  onAddToPlaylist: (videoId: string) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ 
  videos, onUpdate, allTags, isMuted, onMuteChange, highlightedVideoId, 
  getVideoFile, onRegenerate, currentlyPlayingVideoId, onSetPlayingVideoId, 
  scrubCache, isLowMemoryMode, preloadThumbnails, gridSize, onAddToPlaylist,
  playbackRate, onPlaybackRateChange, volume, onVolumeChange
}) => {
  if (videos.length === 0) {
    return (
      <div className="text-center text-brand-text-secondary mt-16 p-8 bg-brand-surface rounded-lg">
        <h3 className="text-2xl font-bold text-white mb-2">No Videos Found</h3>
        <p>No videos match your current filters. Try adjusting your search or filter settings.</p>
      </div>
    );
  }

  const getGridColsClass = (size: number) => {
    switch (size) {
      case 1: return 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'; // Denser
      case 2: return 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'; // Default
      case 3: return 'sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
      case 4: return 'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3'; // Larger
      default: return 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';
    }
  };
  
  const gridClasses = getGridColsClass(gridSize);

  return (
    <div className={`grid grid-cols-1 ${gridClasses} gap-6`}>
      {videos.map(video => (
        <VideoCard 
          key={video.id}
          video={video}
          onUpdate={onUpdate}
          allTags={allTags}
          isMuted={isMuted}
          onMuteChange={onMuteChange}
          volume={volume}
          onVolumeChange={onVolumeChange}
          playbackRate={playbackRate}
          onPlaybackRateChange={onPlaybackRateChange}
          isHighlighted={video.id === highlightedVideoId}
          getVideoFile={getVideoFile}
          onRegenerateThumbnails={onRegenerate}
          currentlyPlayingVideoId={currentlyPlayingVideoId}
          onSetPlayingVideoId={onSetPlayingVideoId}
          scrubCache={scrubCache}
          isLowMemoryMode={isLowMemoryMode}
          preload={preloadThumbnails}
          onAddToPlaylist={onAddToPlaylist}
        />
      ))}
    </div>
  );
};