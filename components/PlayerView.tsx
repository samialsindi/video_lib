import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VideoData, ScrubCache } from '../types';
import { dbService } from '../services/dbService';
import { videoService } from '../services/videoService';
import { Rating as NumericRating } from './Rating';
import { XCircleIcon, TagIcon, CheckIcon, PlayIcon, PauseIcon, RewindIcon, FastForwardIcon, VolumeOffIcon, VolumeUpIcon, ExpandIcon, XIcon, ChevronLeftIcon, TrashIcon, EyeIcon, EyeSlashIcon, HeartIcon, HeartFilledIcon, EyeOffIcon } from './icons/ActionIcons';

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

const PlaylistItem: React.FC<{
    video: VideoData;
    isActive: boolean;
    onClick: () => void;
    onRemove: () => void;
    index: number;
}> = ({ video, isActive, onClick, onRemove, index }) => {
    const [thumbnail, setThumbnail] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        // Thumbnails are not loaded with the main video data, so we fetch them here.
        dbService.getMainThumbnail(video.id).then(thumbData => {
            if (isMounted && thumbData?.thumbnail) {
                setThumbnail(thumbData.thumbnail);
            }
        });
        return () => { isMounted = false; };
    }, [video.id]);

    const videoTitle = video.title || video.relativePath.split('/').pop();

    return (
        <div onClick={onClick} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-brand-primary/30' : 'hover:bg-gray-700/50'}`}>
            <span className="font-mono text-sm text-brand-text-secondary w-6 text-right pr-1">{index + 1}.</span>
            <img src={thumbnail || ''} alt={videoTitle} className="w-24 h-14 object-cover rounded-md bg-gray-800" />
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate text-white" title={videoTitle}>{videoTitle}</p>
                <p className="text-xs text-brand-text-secondary">{formatTime(video.duration)}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-gray-600 flex-shrink-0"><TrashIcon className="w-4 h-4"/></button>
        </div>
    );
};

interface PlayerViewProps {
    playlistIds: string[];
    allVideos: VideoData[];
    onUpdateVideo: (video: VideoData) => void;
    getVideoFile: (video: VideoData) => Promise<File | null>;
    onExit: () => void;
    onUpdatePlaylist: (newIds: string[]) => void;
    allTags: string[];
    // Player state props
    isMuted: boolean;
    onMuteChange: (muted: boolean) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    playbackRate: number;
    onPlaybackRateChange: (rate: number) => void;
    scrubCache: ScrubCache;
    currentIndex: number;
    onSetCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

const VideoMetadataEditor: React.FC<{
    video: VideoData;
    onUpdate: (video: VideoData) => void;
    allTags: string[];
}> = ({ video, onUpdate, allTags }) => {
    const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
    const [stagedTags, setStagedTags] = useState<string[]>(video.tags);
    const [newTagInput, setNewTagInput] = useState('');
    const tagMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setStagedTags(video.tags);
    }, [video.tags]);

    const handleApplyTags = useCallback(() => {
        const newTag = newTagInput.trim().toLowerCase();
        let finalTags = [...stagedTags];
        if (newTag && !finalTags.includes(newTag)) {
            finalTags.push(newTag);
        }
        onUpdate({ ...video, tags: [...new Set(finalTags)].sort() });
        setIsTagMenuOpen(false);
        setNewTagInput('');
    }, [stagedTags, video, onUpdate, newTagInput]);

    const handleNewTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newTag = newTagInput.trim().toLowerCase();
            if (newTag && !stagedTags.includes(newTag)) {
                setStagedTags(current => [...current, newTag].sort());
            }
            setNewTagInput('');
        }
    };

    return (
        <div className="bg-brand-surface p-4 rounded-b-lg">
            <h2 className="text-2xl font-bold text-white line-clamp-2" title={video.title || video.relativePath.split('/').pop()}>
                {video.title || video.relativePath.split('/').pop()}
            </h2>
            <p className="text-sm text-brand-text-secondary truncate mt-1">{video.relativePath}</p>

            <div className="mt-4 flex items-start justify-between gap-4">
                <div className="flex-grow">
                    <div className="flex flex-wrap gap-2">
                        {video.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-700 text-xs text-brand-text-secondary rounded-full flex items-center gap-1">
                                {tag}
                                <button onClick={() => onUpdate({ ...video, tags: video.tags.filter(t => t !== tag) })} className="text-gray-500 hover:text-white"><XCircleIcon className="w-3.5 h-3.5" /></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative mt-2">
                        <button onClick={() => setIsTagMenuOpen(p => !p)} className="flex items-center gap-1.5 px-2 py-1 bg-gray-900 text-sm text-brand-text-secondary rounded-md hover:bg-gray-800">
                            <TagIcon className="w-4 h-4" /> Manage Tags
                        </button>
                        {isTagMenuOpen && (
                            <div ref={tagMenuRef} className="absolute bottom-full mb-2 left-0 w-full max-w-md bg-brand-surface border border-gray-700 rounded-lg shadow-xl z-10 p-2 flex flex-col">
                                <input
                                    type="text"
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    onKeyDown={handleNewTagKeyDown}
                                    placeholder="Add new tag & press Enter"
                                    className="w-full bg-gray-900 text-white rounded px-2 py-1 text-sm placeholder-brand-text-secondary focus:ring-1 focus:ring-brand-primary"
                                    autoFocus
                                />
                                <div className="max-h-48 overflow-y-auto pr-2 mt-2">
                                    {([...new Set([...allTags, ...stagedTags])].sort()).map(tag => (
                                        <button key={tag} onClick={() => setStagedTags(current => current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag])} className="w-full flex items-center gap-3 text-left px-2 py-1.5 rounded-md text-sm group">
                                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${stagedTags.includes(tag) ? 'bg-brand-primary border-brand-primary-hover' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                                {stagedTags.includes(tag) && <CheckIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="flex-grow text-brand-text">{tag}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-700">
                                    <button onClick={() => setIsTagMenuOpen(false)} className="px-3 py-1 text-xs font-semibold rounded bg-gray-600 hover:bg-gray-500 text-white">Cancel</button>
                                    <button onClick={handleApplyTags} className="px-3 py-1 text-xs font-semibold rounded bg-brand-primary hover:bg-brand-primary-hover text-white">Apply</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <NumericRating rating={video.rating} onRatingChange={r => onUpdate({ ...video, rating: r })} />
            </div>
        </div>
    );
};

export const PlayerView: React.FC<PlayerViewProps> = (props) => {
    const { playlistIds, allVideos, onUpdateVideo, getVideoFile, onExit, onUpdatePlaylist, allTags, scrubCache, currentIndex, onSetCurrentIndex, ...playerState } = props;
    
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    
    const [scrubStatus, setScrubStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
    const [localTimelineThumbnails, setLocalTimelineThumbnails] = useState<string[]>([]);
    const [scrubThumbnailUrl, setScrubThumbnailUrl] = useState<string | null>(null);
    const [scrubX, setScrubX] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const clickTimeoutRef = useRef<number | null>(null);
    const controlsTimeoutRef = useRef<number | null>(null);

    const playlist = useMemo(() => playlistIds
        .map(id => allVideos.find(v => v.id === id))
        .filter((v): v is VideoData => !!v), 
    [playlistIds, allVideos]);

    const currentVideo = useMemo(() => {
        // Ensure index is valid for the current playlist
        const validIndex = Math.max(0, Math.min(currentIndex, playlist.length - 1));
        return playlist[validIndex] || null;
    }, [playlist, currentIndex]);

    const onUpdateVideoRef = useRef(onUpdateVideo);
    useEffect(() => {
        onUpdateVideoRef.current = onUpdateVideo;
    }, [onUpdateVideo]);

    const currentVideoRef = useRef(currentVideo);
    useEffect(() => {
        currentVideoRef.current = currentVideo;
    }, [currentVideo]);

    const saveCurrentTime = useCallback(() => {
        if (videoRef.current && currentVideoRef.current) {
            const video = currentVideoRef.current;
            const currentTime = videoRef.current.currentTime;
            const videoDuration = videoRef.current.duration;
            const finalTime = (videoDuration && currentTime >= videoDuration - 1.5) ? 0 : currentTime;
            
            if (Math.abs(finalTime - (video.currentTime || 0)) > 1) {
                onUpdateVideoRef.current({ ...video, currentTime: finalTime, seen: video.seen || finalTime > 1 });
            }
        }
    }, []);

    const loadTimelineThumbnails = useCallback(async () => {
        if (!currentVideo || !currentVideo.isPlayable) {
            setScrubStatus('idle');
            setLocalTimelineThumbnails([]);
            return;
        };
        
        setScrubStatus('loading');

        const cachedThumbs = scrubCache.get(currentVideo.id);
        if (cachedThumbs) {
          setLocalTimelineThumbnails(cachedThumbs);
          setScrubStatus('loaded');
          return;
        }
        
        try {
            const dbThumbs = await dbService.getTimelineThumbnails(currentVideo.id);
            if(dbThumbs) {
                setLocalTimelineThumbnails(dbThumbs.thumbnails);
                scrubCache.set(currentVideo.id, dbThumbs.thumbnails);
                setScrubStatus('loaded');
                return;
            }

            const file = await getVideoFile(currentVideo);
            if (file) {
                const generatedThumbs = await videoService.generateTimelineThumbnails(file, 20);
                if (generatedThumbs && generatedThumbs.length > 0) {
                    await dbService.setTimelineThumbnails(currentVideo.id, generatedThumbs);
                    setLocalTimelineThumbnails(generatedThumbs);
                    scrubCache.set(currentVideo.id, generatedThumbs);
                    setScrubStatus('loaded');
                } else {
                    setScrubStatus('failed');
                }
            } else {
                setScrubStatus('failed');
            }
        } catch (e) {
            console.error("Failed to load timeline thumbnails for player:", e);
            setScrubStatus('failed');
        }
    }, [currentVideo, getVideoFile, scrubCache]);

    useEffect(() => {
        // If the playlist becomes empty while the player is open, exit.
        if (playlist.length === 0) {
            onExit();
        }
    }, [playlist.length, onExit]);

    useEffect(() => {
        let objectUrl: string | undefined;

        if (currentVideo) {
            loadTimelineThumbnails();
            getVideoFile(currentVideo).then(file => {
                if (file) {
                    objectUrl = URL.createObjectURL(file);
                    setVideoSrc(objectUrl);
                } else {
                    setVideoSrc(null);
                }
            });
        } else {
            setVideoSrc(null);
        }

        return () => {
            saveCurrentTime();
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [currentVideo, getVideoFile, saveCurrentTime, loadTimelineThumbnails]);

    const playNext = useCallback(() => {
        if(playlist.length > 0) {
          onSetCurrentIndex((i) => (i + 1) % playlist.length);
        } else {
          setIsPlaying(false);
        }
    }, [playlist.length, onSetCurrentIndex]);

     const playPrevious = useCallback(() => {
        if(playlist.length > 0) {
          onSetCurrentIndex((i) => (i - 1 + playlist.length) % playlist.length);
        }
    }, [playlist.length, onSetCurrentIndex]);

    const handleSeek = useCallback((amount: number) => {
        if (videoRef.current && videoRef.current.duration) {
            videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + amount));
        }
    }, []);
    
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;
    
        if (video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error("Playback failed:", error);
              setIsPlaying(false);
            });
          }
        } else {
          video.pause();
        }
    }, []);
    
    const handleFullscreen = useCallback(() => {
         if (playerContainerRef.current) {
            if (!document.fullscreenElement) {
                playerContainerRef.current.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    }, []);

    const handleSingleClick = useCallback(() => {
        togglePlay();
    }, [togglePlay]);

    const handleDoubleClick = useCallback(() => {
        handleFullscreen();
    }, [handleFullscreen]);

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
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeEl = document.activeElement;
        if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName.toUpperCase())) {
            return;
        }

        let handled = true;
        switch (e.key) {
            case ' ':
                togglePlay();
                break;
            case 'ArrowLeft':
                handleSeek(-10);
                break;
            case 'ArrowRight':
                handleSeek(10);
                break;
            case 'ArrowUp':
                const newVolumeUp = Math.min(1, Math.round((playerState.volume + 0.05) * 100) / 100);
                playerState.onVolumeChange(newVolumeUp);
                if (videoRef.current) videoRef.current.volume = newVolumeUp;
                break;
            case 'ArrowDown':
                const newVolumeDown = Math.max(0, Math.round((playerState.volume - 0.05) * 100) / 100);
                playerState.onVolumeChange(newVolumeDown);
                if (videoRef.current) videoRef.current.volume = newVolumeDown;
                break;
            case 'f':
                handleFullscreen();
                break;
            case 'n':
                playNext();
                break;
            case 'p':
                playPrevious();
                break;
            default:
                handled = false;
        }
        if (handled) e.preventDefault();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playerState.volume, playerState.onVolumeChange, handleFullscreen, togglePlay, handleSeek, playNext, playPrevious]);

    useEffect(() => {
        const handleFscChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFscChange);
        return () => document.removeEventListener('fullscreenchange', handleFscChange);
    }, []);
    
    useEffect(() => {
        if (videoRef.current && videoRef.current.playbackRate !== playerState.playbackRate) {
            videoRef.current.playbackRate = playerState.playbackRate;
        }
    }, [playerState.playbackRate]);

    const handleMouseMove = useCallback(() => {
        setIsControlsVisible(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = window.setTimeout(() => {
            setIsControlsVisible(false);
        }, 3000);
    }, []);


    const handleRemoveFromPlaylist = (videoId: string) => {
        const newPlaylistIds = playlistIds.filter(id => id !== videoId);
        onUpdatePlaylist(newPlaylistIds);
    };
    
    const playbackRates = [0.5, 1, 1.5, 2];

    return (
        <div className="fixed inset-0 bg-brand-bg flex flex-col text-brand-text">
            {/* Header */}
            <header className="bg-brand-surface p-3 flex items-center justify-between shadow-md z-10 flex-shrink-0">
                <button onClick={onExit} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md hover:bg-gray-700">
                    <ChevronLeftIcon /> Back to Grid
                </button>
                <h1 className="text-lg font-bold">Player Mode</h1>
                <div className="w-32"></div>
            </header>
            
            {/* Main Content */}
            <main className="flex-1 flex overflow-hidden">
                {/* Player Section */}
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                    {currentVideo ? (
                        <>
                            <div ref={playerContainerRef} onMouseMove={handleMouseMove} className="bg-black rounded-t-lg aspect-video max-h-[60vh] flex-shrink-0 relative group">
                                <div className="absolute inset-0 w-full h-full cursor-pointer z-10" onClick={handleClick}/>
                                <video
                                    ref={videoRef}
                                    key={currentVideo.id} // Re-mount when video ID changes
                                    src={videoSrc || ''}
                                    className="w-full h-full object-contain pointer-events-none"
                                    muted={playerState.isMuted}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onEnded={playNext}
                                    onLoadedMetadata={() => {
                                        if (videoRef.current && currentVideo) {
                                            setDuration(videoRef.current.duration);
                                            videoRef.current.volume = playerState.volume;
                                            videoRef.current.playbackRate = playerState.playbackRate;
                                            const startTime = currentVideo.currentTime || 0;
                                            if (startTime > 1 && startTime < videoRef.current.duration - 1) {
                                                videoRef.current.currentTime = startTime;
                                            }
                                            setProgress(videoRef.current.currentTime);
                                            const playPromise = videoRef.current.play();
                                            if (playPromise !== undefined) {
                                                playPromise.catch(error => {
                                                    console.error("Autoplay failed for player view:", error);
                                                    setIsPlaying(false);
                                                });
                                            }
                                        }
                                    }}
                                    onTimeUpdate={() => {
                                        if (videoRef.current) {
                                            setProgress(videoRef.current.currentTime);
                                        }
                                    }}
                                    onVolumeChange={() => {
                                      if (videoRef.current) {
                                        playerState.onMuteChange(videoRef.current.muted);
                                        playerState.onVolumeChange(videoRef.current.volume);
                                      }
                                    }}
                                    onRateChange={() => videoRef.current && playerState.onPlaybackRateChange(videoRef.current.playbackRate)}
                                />

                                {/* Player Controls */}
                                <div className={`absolute inset-0 bg-transparent flex flex-col justify-end p-4 bg-gradient-to-t from-black/70 to-transparent z-20 pointer-events-none transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                                    <div 
                                        className="w-full bg-white/20 rounded-full cursor-pointer h-2 relative pointer-events-auto"
                                        onClick={(e) => { if(videoRef.current && duration) { const rect = e.currentTarget.getBoundingClientRect(); videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration; e.stopPropagation(); }}}
                                        onMouseMove={(e) => {
                                            if (scrubStatus !== 'loaded' || localTimelineThumbnails.length === 0) return;
                                            const bar = e.currentTarget;
                                            const rect = bar.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const ratio = x / rect.width;
                                            const index = Math.min(localTimelineThumbnails.length - 1, Math.floor(ratio * localTimelineThumbnails.length));
                                            setScrubThumbnailUrl(localTimelineThumbnails[index]);
                                            setScrubX(x);
                                        }}
                                        onMouseLeave={() => setScrubThumbnailUrl(null)}
                                    >
                                        <div className="h-full bg-brand-primary rounded-full" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
                                        {scrubThumbnailUrl && (
                                            <img 
                                                src={scrubThumbnailUrl} 
                                                className="absolute bottom-full mb-2 border-2 border-white rounded-md shadow-lg pointer-events-none max-h-40" 
                                                style={{ left: scrubX, transform: 'translateX(-50%)' }} 
                                                alt="Scrub preview"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pointer-events-auto">
                                        <div className="flex items-center gap-3">
                                            <button onClick={(e)=>{e.stopPropagation(); togglePlay()}} className="no-click-propagate">{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
                                            <button onClick={(e)=>{e.stopPropagation(); handleSeek(-10)}} title="Rewind 10s (Left Arrow)" className="no-click-propagate"><RewindIcon /></button>
                                            <button onClick={(e)=>{e.stopPropagation(); handleSeek(10)}} title="Forward 10s (Right Arrow)" className="no-click-propagate"><FastForwardIcon /></button>
                                            <button onClick={(e)=>{e.stopPropagation(); playerState.onMuteChange(!playerState.isMuted)}} className="no-click-propagate">{playerState.isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}</button>
                                            <span className="font-mono text-sm">{formatTime(progress)} / {formatTime(duration)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 no-click-propagate">
                                                {playbackRates.map(rate => (
                                                    <button key={rate} onClick={(e) => { e.stopPropagation(); playerState.onPlaybackRateChange(rate);}} className={`px-2 py-0.5 text-xs rounded-md ${playerState.playbackRate === rate ? 'bg-brand-primary text-white' : 'bg-black/50 hover:bg-white/20'}`}>
                                                        {rate}x
                                                    </button>
                                                ))}
                                            </div>
                                             <button title={currentVideo.seen ? "Mark as Unwatched" : "Mark as Watched"} onClick={(e) => { e.stopPropagation(); onUpdateVideo({...currentVideo, seen: !currentVideo.seen}); }} className="no-click-propagate">
                                                {currentVideo.seen ? <EyeSlashIcon className="w-5 h-5 text-brand-primary"/> : <EyeIcon className="w-5 h-5"/>}
                                            </button>
                                            <button title={currentVideo.hearted ? "Unheart" : "Heart"} onClick={(e) => { e.stopPropagation(); onUpdateVideo({ ...currentVideo, hearted: !currentVideo.hearted }); }} className={`p-1.5 rounded-full transition-colors no-click-propagate ${currentVideo.hearted ? 'text-red-500' : 'hover:bg-white/20'}`}>
                                                {currentVideo.hearted ? <HeartFilledIcon className="w-5 h-5"/> : <HeartIcon className="w-5 h-5"/>}
                                            </button>
                                            <button title={currentVideo.hidden ? "Unhide" : "Hide"} onClick={(e) => { e.stopPropagation(); onUpdateVideo({ ...currentVideo, hidden: !currentVideo.hidden }); }} className="p-1.5 rounded-full hover:bg-white/20 no-click-propagate">
                                                {currentVideo.hidden ? <EyeIcon className="w-5 h-5 text-yellow-400"/> : <EyeOffIcon className="w-5 h-5"/>}
                                            </button>
                                            <button title={currentVideo.deleted ? "Restore" : "Delete"} onClick={(e) => { e.stopPropagation(); onUpdateVideo({ ...currentVideo, deleted: !currentVideo.deleted }); }} className={`p-1.5 rounded-full no-click-propagate ${currentVideo.deleted ? 'text-red-500' : 'hover:bg-white/20'}`}>
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={(e) => {e.stopPropagation(); handleFullscreen()}} className="no-click-propagate"><ExpandIcon /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Metadata Editor */}
                             <div className="flex-1 overflow-y-auto">
                                <VideoMetadataEditor video={currentVideo} onUpdate={onUpdateVideo} allTags={allTags} />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-black rounded-lg">
                            <p className="text-xl text-brand-text-secondary">Playlist is empty or finished.</p>
                        </div>
                    )}
                </div>

                {/* Playlist Sidebar */}
                <aside className="w-96 bg-brand-surface flex flex-col p-4 border-l border-gray-700 flex-shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Up Next</h3>
                        <button onClick={() => onUpdatePlaylist([])} className="text-sm text-red-400 hover:underline" disabled={playlist.length === 0}>Clear All</button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {playlist.map((video, index) => (
                           <PlaylistItem
                                key={video.id}
                                video={video}
                                isActive={index === currentIndex}
                                onClick={() => onSetCurrentIndex(index)}
                                onRemove={() => handleRemoveFromPlaylist(video.id)}
                                index={index}
                           />
                        ))}
                         {playlist.length === 0 && <p className="text-center text-brand-text-secondary mt-8">Add videos from the grid to get started.</p>}
                    </div>
                </aside>
            </main>
        </div>
    );
};