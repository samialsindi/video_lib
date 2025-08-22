

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { VideoData, ScrubCache } from '../types';
import { Rating as NumericRating } from './Rating';
import { PlayIcon, EyeIcon, EyeSlashIcon, ExpandIcon, XCircleIcon, TagIcon, PauseIcon, VolumeUpIcon, VolumeOffIcon, RefreshCwIcon, ClipboardCopyIcon, HeartIcon, HeartFilledIcon, RewindIcon, FastForwardIcon, EyeOffIcon, TerminalIcon, TrashIcon, CheckIcon, XIcon, PlusIcon } from './icons/ActionIcons';
import { videoService } from '../services/videoService';
import { dbService } from '../services/dbService';
import { transcodeService } from '../services/transcodeService';

interface VideoCardProps {
  video: VideoData;
  onUpdate: (video: VideoData) => void;
  allTags: string[];
  isMuted: boolean;
  onMuteChange: (isMuted: boolean) => void;
  volume: number;
  onVolumeChange: (newVolume: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  isHighlighted: boolean;
  getVideoFile: (video: VideoData) => Promise<File | null>;
  onRegenerateThumbnails: (video: VideoData) => Promise<void>;
  currentlyPlayingVideoId: string | null;
  onSetPlayingVideoId: React.Dispatch<React.SetStateAction<string | null>>;
  scrubCache: ScrubCache;
  isLowMemoryMode: boolean;
  preload: boolean;
  onAddToPlaylist: (videoId: string) => void;
}

type ScrubbingStatus = 'idle' | 'loading' | 'loaded' | 'failed';

const formatTime = (seconds: number | null) => {
  if (seconds === null || isNaN(seconds) || seconds < 0) return '--:--';
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
  }
  return `${mm.toString().padStart(2, '0')}:${ss}`;
};

const TranscodeHelpModal: React.FC<{ video: VideoData; onClose: () => void; }> = ({ video, onClose }) => {
    const originalPath = video.relativePath;
    const lastDotIndex = originalPath.lastIndexOf('.');
    const pathWithoutExt = lastDotIndex !== -1 ? originalPath.substring(0, lastDotIndex) : originalPath;
    const newPath = `${pathWithoutExt}.mp4`;
    
    const command = `ffmpeg -i "${originalPath}" -c:v libx264 -preset veryfast -c:a aac -movflags +faststart "${newPath}"`;
    const [copyButtonText, setCopyButtonText] = useState('Copy Command');

    const handleCopy = () => {
        navigator.clipboard.writeText(command);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy Command'), 2000);
    };

    return createPortal(
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-brand-surface rounded-lg shadow-2xl p-6 max-w-2xl w-full text-brand-text"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3"><TerminalIcon className="w-8 h-8 text-brand-primary"/> Conversion Help</h2>
                    <button onClick={onClose} className="text-brand-text-secondary hover:text-white">
                        <XIcon className="w-8 h-8" />
                    </button>
                </div>
                <p className="mb-4 text-brand-text-secondary">This video format (<code className="text-xs bg-gray-900 px-1 py-0.5 rounded">{originalPath.split('.').pop()}</code>) cannot be played in the browser. To watch it, you need to convert it to a compatible format like MP4 using the free, open-source tool <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">FFmpeg</a>.</p>
                
                <div className="mb-4">
                    <h3 className="font-semibold text-lg text-white mb-2">1. Install FFmpeg</h3>
                    <p className="text-sm text-brand-text-secondary">If you don't have FFmpeg, you can install it using a package manager:</p>
                    <ul className="list-disc list-inside pl-2 mt-1 text-sm text-brand-text-secondary">
                        <li><strong className="text-white">macOS (Homebrew):</strong> <code className="text-xs bg-gray-900 p-1 rounded">brew install ffmpeg</code></li>
                        <li><strong className="text-white">Windows (Chocolatey):</strong> <code className="text-xs bg-gray-900 p-1 rounded">choco install ffmpeg</code></li>
                        <li><strong className="text-white">Linux (apt/dnf):</strong> <code className="text-xs bg-gray-900 p-1 rounded">sudo apt install ffmpeg</code></li>
                    </ul>
                </div>

                <div className="mb-6">
                    <h3 className="font-semibold text-lg text-white mb-2">2. Run Conversion Command</h3>
                    <p className="text-sm text-brand-text-secondary mb-2">Open your terminal or command prompt, navigate to your main video directory, and run the following command:</p>
                    <div className="bg-gray-900 p-3 rounded-lg font-mono text-sm text-yellow-300 break-words relative">
                        {command}
                        <button onClick={handleCopy} className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover transition-colors font-semibold text-xs">
                            <ClipboardCopyIcon className="w-4 h-4" />
                            {copyButtonText}
                        </button>
                    </div>
                </div>

                <p className="text-sm text-brand-text-secondary">After the conversion is complete, click "Select Folder" in the header again to re-scan your library. The new MP4 version will appear and be playable.</p>
            </div>
        </div>,
        document.body
    );
};

export const VideoCard: React.FC<VideoCardProps> = ({ 
  video, onUpdate, allTags, isMuted, onMuteChange, isHighlighted, 
  getVideoFile, onRegenerateThumbnails, currentlyPlayingVideoId, 
  onSetPlayingVideoId, scrubCache, isLowMemoryMode, preload, onAddToPlaylist,
  playbackRate, onPlaybackRateChange, volume, onVolumeChange
}) => {
  const isPlayerActive = video.id === currentlyPlayingVideoId;
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [tagMenuPositionClass, setTagMenuPositionClass] = useState('bottom-full mb-2');
  const [stagedTags, setStagedTags] = useState<string[]>(video.tags);
  const [newTagInput, setNewTagInput] = useState('');
  
  const [mainThumbnail, setMainThumbnail] = useState<string | null>(null);
  const [isThumbBlack, setIsThumbBlack] = useState(false);
  
  const [localTimelineThumbnails, setLocalTimelineThumbnails] = useState<string[]>([]);
  const [scrubStatus, setScrubStatus] = useState<ScrubbingStatus>('idle');
  
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showCopyPathInfo, setShowCopyPathInfo] = useState(false);
  const [showTranscodeHelp, setShowTranscodeHelp] = useState(false);
  const [copyStatus, setCopyStatus] = useState('Copy Path');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  const [progress, setProgress] = useState(video.currentTime || 0);
  const [duration, setDuration] = useState(video.duration);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const manageTagsButtonRef = useRef<HTMLButtonElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const cursorHideTimeoutRef = useRef<number | null>(null);
  const [isInView, setIsInView] = useState(false);
  const lastSavedTimeRef = useRef(video.currentTime || 0);
  const [scrubThumbnailUrl, setScrubThumbnailUrl] = useState<string | null>(null);
  const [scrubX, setScrubX] = useState(0);
  const [cardScrubThumbnail, setCardScrubThumbnail] = useState<string | null>(null);
  const wasFullscreenTarget = useRef(false);
  
  const fileName = video.relativePath.split('/').pop() || 'Untitled';
  const directoryPath = video.relativePath.substring(0, video.relativePath.lastIndexOf('/')) || '.';
  const [editableTitle, setEditableTitle] = useState(video.title || fileName);

  const canBeTranscoded = transcodeService.isTranscodable(fileName);

  const handleApplyTags = useCallback(() => {
    const newTag = newTagInput.trim();
    let finalTags = [...stagedTags];
    if (newTag && !finalTags.includes(newTag)) {
        finalTags.push(newTag);
    }
    
    const sortedFinal = [...new Set(finalTags)].sort();
    const sortedCurrent = [...video.tags].sort();

    if (JSON.stringify(sortedFinal) !== JSON.stringify(sortedCurrent)) {
      onUpdate({ ...video, tags: sortedFinal });
    }
    setIsTagMenuOpen(false);
    setNewTagInput('');
  }, [stagedTags, video, onUpdate, newTagInput]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    const videoElement = videoRef.current;
  
    if (videoElement.paused) {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Video play failed:", error);
          // Ensure state is correct if play() is rejected by the browser.
          setIsActuallyPlaying(false);
        });
      }
    } else {
      videoElement.pause();
    }
  }, []);

  const handleAddNewTag = () => {
    const newTag = newTagInput.trim();
    if (newTag && !stagedTags.includes(newTag)) {
        setStagedTags(current => [...current, newTag].sort());
    }
    setNewTagInput('');
  };

  const handleNewTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent global shortcuts
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNewTag();
    }
  };

  useEffect(() => {
    if (isTagMenuOpen) {
      setStagedTags(video.tags);
    }
  }, [isTagMenuOpen, video.tags]);
  
  useEffect(() => {
    const handleDocumentInteraction = (event: MouseEvent | KeyboardEvent) => {
      if (!isTagMenuOpen) return;
      
      const target = event.target as Node;

      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        const inputIsFocused = tagMenuRef.current?.querySelector('input') === document.activeElement;
        if (inputIsFocused && newTagInput) {
            setNewTagInput('');
        } else {
            setIsTagMenuOpen(false);
            setNewTagInput('');
        }
        return;
      }
      
      if (event instanceof MouseEvent) {
          if (tagMenuRef.current && !tagMenuRef.current.contains(target)) {
              handleApplyTags();
          }
      }
    };
    
    document.addEventListener('mousedown', handleDocumentInteraction);
    document.addEventListener('keydown', handleDocumentInteraction);
    return () => {
      document.removeEventListener('mousedown', handleDocumentInteraction);
      document.removeEventListener('keydown', handleDocumentInteraction);
    };
  }, [isTagMenuOpen, handleApplyTags, newTagInput]);

  const handleStagedTagToggle = (tag: string) => {
    setStagedTags(current =>
      current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    );
  };
  
  const saveProgress = useCallback((time: number) => {
    if (time > 0 && Math.abs(time - lastSavedTimeRef.current) > 5) {
        const updatedFields: Partial<VideoData> = { currentTime: time };
        if (time > 1 && !video.seen) {
            updatedFields.seen = true;
        }
        onUpdate({ ...video, ...updatedFields });
        lastSavedTimeRef.current = time;
    }
  }, [video, onUpdate]);

  const startNativePlayback = useCallback(async () => {
      if(videoSrc || !video.isPlayable) return;
      const file = await getVideoFile(video);
      if (file) {
          setVideoSrc(URL.createObjectURL(file));
      } else if (canBeTranscoded) {
          setShowTranscodeHelp(true);
      }
  }, [video, getVideoFile, videoSrc, canBeTranscoded]);

  const stopPlayback = useCallback(() => {
    if (videoRef.current) {
        if (videoRef.current.currentTime > 0) {
            const currentTime = videoRef.current.currentTime;
            const videoDuration = videoRef.current.duration;
            const finalTime = currentTime >= videoDuration - 1 ? 0 : currentTime;
            if (Math.abs(finalTime - (video.currentTime || 0)) > 1) {
                const updatedFields: Partial<VideoData> = { currentTime: finalTime };
                if (finalTime > 0 && !video.seen) updatedFields.seen = true;
                onUpdate({ ...video, ...updatedFields });
            }
        }
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load(); // Force unload of the resource
    }
    
    if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(null);
    setIsActuallyPlaying(false);
    setScrubStatus('idle');
    setLocalTimelineThumbnails([]);
  }, [videoSrc, onUpdate, video]);

  const handleSingleClick = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) {
      activeElement.blur();
    }

    if (isPlayerActive) {
      togglePlay();
    } else {
      onSetPlayingVideoId(video.id);
    }
  }, [isPlayerActive, video.id, onSetPlayingVideoId, togglePlay]);

  const handleDoubleClick = useCallback(() => {
    if (playerContainerRef.current) {
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
            wasFullscreenTarget.current = true;
        } else {
            document.exitFullscreen();
        }
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-click-propagate')) {
        return;
    }
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDoubleClick();
    } else {
      clickTimeoutRef.current = window.setTimeout(() => {
        handleSingleClick();
        clickTimeoutRef.current = null;
      }, 250);
    }
  }, [handleSingleClick, handleDoubleClick]);

  useEffect(() => {
    const handleFullscreenChange = () => {
        const isNowFullscreen = !!document.fullscreenElement;
        setIsFullscreen(isNowFullscreen);

        if (!isNowFullscreen && wasFullscreenTarget.current) {
            cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            wasFullscreenTarget.current = false;
        } else if (!isNowFullscreen) {
            wasFullscreenTarget.current = false;
        }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  const loadTimelineThumbnails = useCallback(async () => {
    if (!video.isPlayable || scrubStatus !== 'idle') return;

    setScrubStatus('loading');
    const cachedThumbs = scrubCache.get(video.id);
    if (cachedThumbs) {
      setLocalTimelineThumbnails(cachedThumbs);
      setScrubStatus('loaded');
      return;
    }
    
    try {
        const dbThumbs = await dbService.getTimelineThumbnails(video.id);
        if(dbThumbs) {
            setLocalTimelineThumbnails(dbThumbs.thumbnails);
            scrubCache.set(video.id, dbThumbs.thumbnails);
            setScrubStatus('loaded');
            return;
        }

        const file = await getVideoFile(video);
        if (file) {
            const generatedThumbs = await videoService.generateTimelineThumbnails(file, 20);
            if (generatedThumbs && generatedThumbs.length > 0) {
                await dbService.setTimelineThumbnails(video.id, generatedThumbs);
                setLocalTimelineThumbnails(generatedThumbs);
                scrubCache.set(video.id, generatedThumbs);
                setScrubStatus('loaded');
            } else {
                setScrubStatus('failed');
            }
        } else {
            setScrubStatus('failed');
        }
    } catch (e) {
        console.error("Failed to load timeline thumbnails:", e);
        setScrubStatus('failed');
    }
  }, [video, getVideoFile, scrubCache, scrubStatus]);

  const loadAndCheckThumbnail = useCallback(() => {
      dbService.getMainThumbnail(video.id).then(thumb => {
          if(thumb?.thumbnail) {
              videoService.isDataUrlBlack(thumb.thumbnail).then(isBlack => {
                  if (isBlack) {
                      setIsThumbBlack(true);
                      // Pre-emptively load timeline thumbs for a fallback
                      loadTimelineThumbnails();
                  }
                  setMainThumbnail(thumb.thumbnail);
              });
          }
      });
  }, [video.id, loadTimelineThumbnails]);

  useEffect(() => {
    if (isInView && !mainThumbnail) {
      loadAndCheckThumbnail();
    }
  }, [isInView, mainThumbnail, loadAndCheckThumbnail]);

  useEffect(() => {
    if (isPlayerActive) {
        startNativePlayback();
    } else {
        if (videoSrc) {
            stopPlayback();
        }
    }
  }, [isPlayerActive, startNativePlayback, stopPlayback, videoSrc]);

  useEffect(() => {
      // Cleanup effect to revoke object URL on unmount to prevent memory leaks
      return () => {
          if (videoSrc) {
              URL.revokeObjectURL(videoSrc);
          }
      };
  }, [videoSrc]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '200px' }
    );
    if(cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);
  
  const handleSeek = useCallback((amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + amount));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayerActive || !videoRef.current) return;
      
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName.toUpperCase())) {
          return;
      }

      let handled = true;
      switch (e.key) {
        case ' ': // Space bar for play/pause
           e.preventDefault();
           togglePlay();
           break;
        case 'ArrowLeft':
          handleSeek(-10);
          break;
        case 'ArrowRight':
          handleSeek(10);
          break;
        case 'ArrowUp':
          const newVolumeUp = Math.min(1, Math.round((volume + 0.05) * 100) / 100);
          onVolumeChange(newVolumeUp);
          break;
        case 'ArrowDown':
           const newVolumeDown = Math.max(0, Math.round((volume - 0.05) * 100) / 100);
           onVolumeChange(newVolumeDown);
          break;
        default:
          handled = false;
          break;
      }
      if (handled) {
          e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlayerActive, onVolumeChange, volume, handleSeek, togglePlay]);
  
  useEffect(() => {
      if (video.title !== editableTitle && !isEditingTitle) {
          setEditableTitle(video.title || fileName);
      }
  }, [video.title, fileName, isEditingTitle]);
  
  useEffect(() => {
    // Gentle background loading of scrub thumbnails for visible cards when not in low memory mode.
    if (preload && !isPlayerActive && isInView && !isLowMemoryMode) {
      loadTimelineThumbnails();
    } 
    // Always load on hover, regardless of memory mode, for immediate user feedback.
    else if (isHovering && !isPlayerActive && isInView) {
      loadTimelineThumbnails();
    }
  }, [preload, isHovering, isPlayerActive, isInView, isLowMemoryMode, loadTimelineThumbnails]);
  
  useEffect(() => {
    if (videoRef.current && videoRef.current.playbackRate !== playbackRate) {
        videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleProgressBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scrubStatus !== 'loaded' || localTimelineThumbnails.length === 0) return;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const index = Math.min(localTimelineThumbnails.length - 1, Math.floor(ratio * localTimelineThumbnails.length));
    setScrubThumbnailUrl(localTimelineThumbnails[index]);
    setScrubX(x);
  };

  const handleCardHoverScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPlayerActive && isActuallyPlaying) {
      setCardScrubThumbnail(null);
      return;
    }
    if (scrubStatus !== 'loaded' || localTimelineThumbnails.length === 0) {
      setCardScrubThumbnail(null);
      return;
    }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const index = Math.min(localTimelineThumbnails.length - 1, Math.floor(ratio * localTimelineThumbnails.length));
    setCardScrubThumbnail(localTimelineThumbnails[index]);
  };

  const handleTitleClick = () => {
    if (video.deleted || video.notFound) return;
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    const newTitle = editableTitle.trim();
    if (newTitle === fileName) {
      if (video.title !== undefined) onUpdate({ ...video, title: undefined });
    } else if (newTitle && newTitle !== (video.title || fileName)) {
      onUpdate({ ...video, title: newTitle });
    } else {
       setEditableTitle(video.title || fileName);
    }
  };
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTitleBlur();
    if (e.key === 'Escape') {
      setEditableTitle(video.title || fileName);
      setIsEditingTitle(false);
    }
  };
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.setSelectionRange(0, 0);
    }
  }, [isEditingTitle]);

  const handleCopyPath = () => {
      navigator.clipboard.writeText(video.relativePath);
      setCopyStatus("Copied!");
      setShowCopyPathInfo(true);
      setTimeout(() => {
          setShowCopyPathInfo(false);
          setCopyStatus("Copy Path");
      }, 2000);
  }

  const handleRegen = async () => {
    setIsRegenerating(true);
    try {
        await onRegenerateThumbnails(video);
        // After regenerating, we need to re-check the thumbnail
        setMainThumbnail(null);
        setIsThumbBlack(false);
        loadAndCheckThumbnail();
    } finally {
        setIsRegenerating(false);
    }
  };

  const handleOpenTagMenu = () => {
      if (manageTagsButtonRef.current) {
          const rect = manageTagsButtonRef.current.getBoundingClientRect();
          // Approx height of menu is ~280px
          if (rect.top < 300) {
              setTagMenuPositionClass('top-full mt-2');
          } else {
              setTagMenuPositionClass('bottom-full mb-2');
          }
      }
      setIsTagMenuOpen(true);
  };


  const cardClasses = `bg-brand-surface rounded-xl overflow-hidden shadow-lg flex flex-col group relative transition-all duration-300 ${
    isHighlighted ? 'ring-4 ring-brand-primary ring-offset-2 ring-offset-brand-bg' : ''
  } ${
    video.deleted ? 'opacity-50 ring-2 ring-red-800' : ''
  } ${
    video.notFound ? 'opacity-50 ring-2 ring-orange-800' : ''
  }`;

  const renderThumbnail = () => {
    if (cardScrubThumbnail) {
        return <img src={cardScrubThumbnail} className="w-full h-full object-cover" alt="Scrub preview" />;
    }
    if (isThumbBlack && localTimelineThumbnails.length > 0) {
        return <img src={localTimelineThumbnails[0]} className="w-full h-full object-cover" alt="Fallback thumbnail" />;
    }
    if (mainThumbnail) {
        return <img src={mainThumbnail} className="w-full h-full object-cover" alt="Video thumbnail"/>;
    }
    return (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            {video.description && <p className="text-brand-text-secondary text-sm p-4 text-center">{video.description}</p>}
        </div>
    );
  };


  return (
    <div
      ref={cardRef}
      id={video.id}
      className={cardClasses}
      onMouseEnter={() => !video.deleted && setIsHovering(true)}
      onMouseLeave={() => !video.deleted && setIsHovering(false)}
    >
      {showTranscodeHelp && <TranscodeHelpModal video={video} onClose={() => setShowTranscodeHelp(false)} />}
      <div 
        ref={playerContainerRef} 
        className="aspect-video bg-black flex items-center justify-center relative"
        onMouseMove={handleCardHoverScrub}
        onMouseLeave={() => setCardScrubThumbnail(null)}
      >
        <div 
            className="absolute inset-0 w-full h-full cursor-pointer z-10"
            onClick={
                video.isPlayable && !video.deleted && !video.notFound
                    ? handleClick 
                    : (!video.isPlayable && canBeTranscoded ? () => setShowTranscodeHelp(true) : undefined)
            }
        />
        
        {isHovering && !isPlayerActive && scrubStatus === 'loading' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-10">
                <p className="text-white font-semibold animate-pulse">Loading Scrub Previews...</p>
            </div>
        )}

        {(isPlayerActive ? isActuallyPlaying : false) || (!isPlayerActive && (
          <div className="w-full h-full relative pointer-events-none">
            {renderThumbnail()}
            
            {video.duration && video.currentTime && video.currentTime > 1 && (
                <div className="absolute bottom-0 left-0 h-1.5 w-full bg-gray-900/50">
                    <div className="h-full bg-brand-primary" style={{ width: `${(video.currentTime / video.duration) * 100}%` }} />
                </div>
            )}
          </div>
        ))}
        
        {isPlayerActive && videoSrc && (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              style={{ pointerEvents: 'none', display: isPlayerActive ? 'block' : 'none' }}
              loop
              muted={isMuted}
              onPlay={() => {
                setIsActuallyPlaying(true);
                onUpdate({ ...video, timesOpened: video.timesOpened + 1 });
              }}
              onPause={() => {
                setIsActuallyPlaying(false);
                // NOTE: removed onUpdate from here to prevent re-render loop on pause.
                // Progress is saved via onTimeUpdate and stopPlayback.
              }}
              onTimeUpdate={() => {
                if(videoRef.current) {
                    const currentTime = videoRef.current.currentTime;
                    setProgress(currentTime);
                    saveProgress(currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                    videoRef.current.volume = volume;
                    videoRef.current.playbackRate = playbackRate;
                    if (video.currentTime && video.currentTime > 1 && video.currentTime < videoRef.current.duration - 1) {
                        videoRef.current.currentTime = video.currentTime;
                    }
                    lastSavedTimeRef.current = videoRef.current.currentTime;
                     if (isPlayerActive) {
                        const playPromise = videoRef.current.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => {
                                console.warn("Autoplay was prevented.", e);
                                setIsActuallyPlaying(false);
                            });
                        }
                    }
                }
              }}
              onEnded={() => {
                  onUpdate({ ...video, currentTime: 0, seen: true });
                  setIsActuallyPlaying(false);
              }}
              onVolumeChange={() => {
                  if (videoRef.current) {
                      onVolumeChange(videoRef.current.volume)
                      onMuteChange(videoRef.current.muted)
                  }
              }}
              onRateChange={() => videoRef.current && onPlaybackRateChange(videoRef.current.playbackRate)}
            />
        )}
        
        {isHovering && !isPlayerActive && video.isPlayable && !video.notFound && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"><PlayIcon className="w-16 h-16 text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]" /></div>}
        {(!video.isPlayable && !canBeTranscoded && !mainThumbnail) && <div className="text-center text-red-400 p-2 text-sm bg-black/50">{video.description || "Incompatible format"}</div>}
        
        {video.notFound && (
            <div className="absolute inset-0 flex flex-col gap-2 items-center justify-center bg-black/70 text-orange-400 p-2 text-sm pointer-events-none z-10">
                <XIcon className="w-10 h-10" />
                <span className="font-bold">File Not Found</span>
            </div>
        )}
        
        {(!video.isPlayable && canBeTranscoded && !video.notFound) && (
            <div className="absolute inset-0 flex flex-col gap-2 items-center justify-center bg-black/70 text-yellow-300 p-2 text-sm pointer-events-none z-10">
                <TerminalIcon className="w-10 h-10" />
                <span className="font-bold">Conversion Required</span>
                <span className="text-xs">(Click card for instructions)</span>
            </div>
        )}

        {isPlayerActive && (
          <div 
            className="absolute inset-0 pointer-events-none"
            onMouseMove={() => {
              if (playerContainerRef.current) playerContainerRef.current.style.setProperty('cursor', 'default');
              if(cursorHideTimeoutRef.current) clearTimeout(cursorHideTimeoutRef.current);
              cursorHideTimeoutRef.current = window.setTimeout(() => {
                  if(isFullscreen && playerContainerRef.current) playerContainerRef.current.style.setProperty('cursor', 'none');
              }, 3000)
            }}
          >
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto ${isFullscreen ? 'p-4' : 'p-1.5'}`}>
              <div 
                  className={`w-full bg-white/20 rounded-full cursor-pointer group/progress relative ${isFullscreen ? 'h-2.5' : 'h-1.5'}`}
                  onMouseMove={handleProgressBarHover}
                  onMouseLeave={() => setScrubThumbnailUrl(null)}
                  onClick={(e) => {
                      if(videoRef.current) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const newTime = ((e.clientX - rect.left) / rect.width) * (duration || 0);
                          videoRef.current.currentTime = newTime;
                      }
                      e.stopPropagation();
                  }}
              >
                  <div className="h-full bg-brand-primary rounded-full" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
                  {scrubThumbnailUrl && (
                    <img 
                      src={scrubThumbnailUrl} 
                      className={`absolute bottom-full mb-2 border-2 border-white rounded-md shadow-lg pointer-events-none ${isFullscreen ? 'max-h-40' : 'max-h-28'}`} 
                      style={{ left: scrubX, transform: 'translateX(-50%)' }} 
                      alt="Scrub preview"
                    />
                  )}
              </div>
              <div className={`flex items-center justify-between ${isFullscreen ? 'mt-3 text-base' : 'mt-1 text-xs'}`}>
                <div className={`flex items-center ${isFullscreen ? 'gap-x-4' : 'gap-x-2'}`}>
                  <button onClick={(e)=>{e.stopPropagation(); togglePlay()}}>
                    {isActuallyPlaying ? <PauseIcon className={isFullscreen ? 'w-10 h-10' : 'w-5 h-5'}/> : <PlayIcon className={isFullscreen ? 'w-10 h-10' : 'w-5 h-5'}/>}
                  </button>
                  
                  {isFullscreen && <button onClick={(e)=>{e.stopPropagation(); handleSeek(-300)}} className="font-bold text-xl px-2 rounded hover:bg-white/20">-5m</button>}
                  {isFullscreen && <button onClick={(e)=>{e.stopPropagation(); handleSeek(-60)}} className="font-bold text-xl px-2 rounded hover:bg-white/20">-1m</button>}
                  
                  <button onClick={(e)=>{e.stopPropagation(); handleSeek(-10)}} title="Rewind 10s">
                    <RewindIcon className={isFullscreen ? 'w-8 h-8' : 'w-4 h-4'}/>
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); handleSeek(10)}} title="Forward 10s">
                    <FastForwardIcon className={isFullscreen ? 'w-8 h-8' : 'w-4 h-4'}/>
                  </button>
              
                  {isFullscreen && <button onClick={(e)=>{e.stopPropagation(); handleSeek(60)}} className="font-bold text-xl px-2 rounded hover:bg-white/20">+1m</button>}
                  {isFullscreen && <button onClick={(e)=>{e.stopPropagation(); handleSeek(300)}} className="font-bold text-xl px-2 rounded hover:bg-white/20">+5m</button>}

                  <button onClick={(e)=>{e.stopPropagation(); onMuteChange(!isMuted) }}>
                    {isMuted ? <VolumeOffIcon className={isFullscreen ? 'w-7 h-7' : 'w-4 h-4'}/> : <VolumeUpIcon className={isFullscreen ? 'w-7 h-7' : 'w-4 h-4'}/>}
                  </button>
                  <span className={`font-mono ${isFullscreen ? 'text-lg' : ''}`}>{formatTime(progress)} / {formatTime(duration)}</span>
                </div>
                <div className={`flex items-center ${isFullscreen ? 'gap-4' : 'gap-1.5'}`}>
                  <div className={`flex items-center no-click-propagate ${isFullscreen ? 'gap-2' : 'gap-1'}`}>
                      {[0.5, 1, 1.5, 2].map(rate => (
                          <button
                              key={rate}
                              onClick={(e) => { e.stopPropagation(); onPlaybackRateChange(rate); }}
                              className={`rounded-md transition-colors ${playbackRate === rate ? 'bg-brand-primary text-white' : 'bg-black/50 hover:bg-white/20'} ${isFullscreen ? 'px-2.5 py-1 text-sm font-semibold' : 'px-2 py-0.5 text-xs'}`}
                          >
                              {rate}x
                          </button>
                      ))}
                  </div>
                  <button title={video.seen ? "Mark as Unwatched" : "Mark as Watched"} onClick={(e)=>{e.stopPropagation(); onUpdate({...video, seen: !video.seen})}}>
                    {video.seen ? <EyeSlashIcon className={`${isFullscreen ? 'w-6 h-6' : 'w-3.5 h-3.5'} text-brand-primary`}/> : <EyeIcon className={isFullscreen ? 'w-6 h-6' : 'w-3.5 h-3.5'}/>}
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); handleDoubleClick()}}>
                    <ExpandIcon className={isFullscreen ? 'w-7 h-7' : 'w-4 h-4'}/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {(isHovering || isPlayerActive) && !isEditingTitle && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 p-1 rounded-md z-20 no-click-propagate">
          <button title="Add to Queue" onClick={() => onAddToPlaylist(video.id)} className="p-1 rounded-full hover:bg-gray-600 transition-colors">
            <PlusIcon className="w-5 h-5 text-green-400"/>
          </button>
          <button title={video.hearted ? "Unheart" : "Heart"} onClick={() => onUpdate({ ...video, hearted: !video.hearted })} className={`p-1 rounded-full transition-colors ${video.hearted ? 'text-red-500 bg-red-900/50' : 'hover:bg-gray-600'}`}>
            {video.hearted ? <HeartFilledIcon className="w-5 h-5"/> : <HeartIcon className="w-5 h-5"/>}
          </button>
          <button title={video.hidden ? "Unhide" : "Hide"} onClick={() => onUpdate({ ...video, hidden: !video.hidden })} className="p-1 rounded-full hover:bg-gray-600 transition-colors">
            {video.hidden ? <EyeIcon className="w-5 h-5 text-yellow-400"/> : <EyeOffIcon className="w-5 h-5"/>}
          </button>
           <button title={video.deleted ? "Restore" : "Delete"} onClick={() => onUpdate({ ...video, deleted: !video.deleted })} className="p-1 rounded-full hover:bg-gray-600 transition-colors">
            <TrashIcon className="w-5 h-5 text-red-400" />
          </button>
          <button disabled={isRegenerating || video.notFound} title="Regenerate Thumbnail" onClick={handleRegen} className="p-1 rounded-full hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors">
            <RefreshCwIcon className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
      
      <div className="p-3 flex-grow flex flex-col justify-between">
        <div>
          <h3
            className="font-bold text-white leading-tight hover:text-brand-primary transition-colors cursor-pointer"
            onClick={handleTitleClick}
            title={editableTitle}
          >
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="w-full bg-gray-900 text-white rounded p-1 -m-1"
              />
            ) : (
              <span className="line-clamp-2">{editableTitle}</span>
            )}
          </h3>
          <p className="text-xs text-brand-text-secondary mt-1 truncate" title={directoryPath}>
            {directoryPath}
          </p>
          <div className="flex justify-between items-start gap-2 mt-2">
            <div className="flex-grow">
                <div className="min-h-[56px] relative">
                  <div className="flex flex-wrap gap-1.5">
                      {video.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-700 text-xs text-brand-text-secondary rounded-full flex items-center gap-1">
                          {tag}
                          {!video.deleted && !video.notFound &&
                           <button onClick={() => onUpdate({ ...video, tags: video.tags.filter(t => t !== tag) })} className="text-gray-500 hover:text-white"><XCircleIcon className="w-3.5 h-3.5"/></button>
                          }
                        </span>
                      ))}
                  </div>
                  {!video.deleted && !video.notFound && (
                      <div className={`mt-1.5 transition-opacity duration-200 ${isHovering || isTagMenuOpen ? 'opacity-100' : 'opacity-0'}`}>
                          <button 
                              ref={manageTagsButtonRef}
                              onClick={handleOpenTagMenu}
                              disabled={!isHovering && !isTagMenuOpen}
                              className="flex items-center gap-1.5 px-2 py-1 bg-gray-900 text-sm text-brand-text-secondary rounded-md hover:bg-gray-800 transition-colors disabled:cursor-default disabled:bg-transparent disabled:text-transparent"
                          >
                              <TagIcon className="w-4 h-4" /> Manage Tags
                          </button>
                      </div>
                  )}
                  {isTagMenuOpen && (
                    <div ref={tagMenuRef} className={`absolute ${tagMenuPositionClass} left-0 w-full bg-brand-surface border border-gray-700 rounded-lg shadow-xl z-40 p-2 flex flex-col`}>
                        <div className="p-1 border-b border-gray-700 mb-2">
                            <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={handleNewTagKeyDown}
                                placeholder="Add new tag & press Enter"
                                className="w-full bg-gray-900 text-white rounded px-2 py-1 text-sm placeholder-brand-text-secondary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto pr-2">
                            {([...new Set([...allTags, ...stagedTags])].sort()).map(tag => (
                                <button key={tag} onClick={() => handleStagedTagToggle(tag)} className="w-full flex items-center gap-3 text-left px-2 py-1.5 rounded-md text-sm font-medium transition-colors group">
                                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${stagedTags.includes(tag) ? 'bg-brand-primary border-brand-primary-hover' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                        {stagedTags.includes(tag) && <CheckIcon className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="flex-grow text-brand-text">{tag}</span>
                                </button>
                            ))}
                            {allTags.length === 0 && stagedTags.length === 0 && <span className="text-xs text-brand-text-secondary px-2">No tags exist. Type to add one.</span>}
                        </div>
                        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-700">
                            <button onClick={() => { setIsTagMenuOpen(false); setNewTagInput(''); }} className="px-3 py-1 text-xs font-semibold rounded bg-gray-600 hover:bg-gray-500 text-white">Cancel</button>
                            <button onClick={handleApplyTags} className="px-3 py-1 text-xs font-semibold rounded bg-brand-primary hover:bg-brand-primary-hover text-white">Apply</button>
                        </div>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
        
        <div className="mt-2 flex items-end justify-between">
            <NumericRating rating={video.rating} onRatingChange={r => onUpdate({...video, rating: r})} disabled={video.deleted || video.notFound} />

            <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                <button title={video.seen ? "Mark as Unwatched" : "Mark as Watched"} onClick={() => onUpdate({ ...video, seen: !video.seen })} className="p-1 rounded-full hover:bg-gray-700/50 transition-colors" disabled={video.notFound}>
                  {video.seen ? <EyeSlashIcon className="w-5 h-5 text-brand-primary"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
                <button title={copyStatus} onClick={handleCopyPath} className="relative p-1 rounded-full hover:bg-gray-700/50 transition-colors">
                    <ClipboardCopyIcon className="w-5 h-5" />
                    {showCopyPathInfo && <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-2 py-1 text-xs rounded-md shadow-lg">Path Copied!</span>}
                </button>
                <span>{videoService.formatBytes(video.fileSize)}</span>
                <span>|</span>
                <span>{formatTime(video.duration)}</span>
            </div>
        </div>
      </div>
    </div>
  );
};