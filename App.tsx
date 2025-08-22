



import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoGrid } from './components/VideoGrid';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProcessingStatusBar } from './components/ProcessingStatusBar';
import { videoService } from './services/videoService';
import { dbService } from './services/dbService';
import { transcodeService } from './services/transcodeService';
import { VideoData, StatusFilter, ScrubCache, SortCriteria, SortDirection, StatusFilterMap } from './types';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SelectFolderScreen } from './components/SelectFolderScreen';
import { Toast } from './components/Toast';
import { Pagination } from './components/Pagination';
import { PlayerView } from './components/PlayerView';

const VIDEOS_PER_PAGE = 100;

interface HistoryEntry {
  videoId: string;
  state: VideoData;
}
type HistoryBatch = HistoryEntry[];


const getInitialStatusFilters = (): StatusFilterMap => {
  try {
    const savedFiltersJSON = localStorage.getItem('videoLibraryStatusFilters');
    if (savedFiltersJSON) {
      const savedFilters = JSON.parse(savedFiltersJSON);
      if (Array.isArray(savedFilters)) {
        return new Map(savedFilters);
      }
    }
  } catch (error) {
    console.error("Failed to load status filters from local storage", error);
  }
  return new Map();
};

const getInitialPlaylist = (): string[] => {
    try {
        const savedPlaylist = localStorage.getItem('videoLibraryPlaylist');
        if (savedPlaylist) {
            const ids = JSON.parse(savedPlaylist);
            if(Array.isArray(ids)) return ids;
        }
    } catch (e) {
        console.error("Failed to load playlist from local storage", e);
    }
    return [];
};

const getInitialPlayerIndex = (): number => {
    try {
        const savedIndex = localStorage.getItem('videoLibraryPlayerIndex');
        if (savedIndex) {
            const index = parseInt(savedIndex, 10);
            if(!isNaN(index)) return index;
        }
    } catch (e) {
        console.error("Failed to load player index from local storage", e);
    }
    return 0;
};


function App() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [statusFilters, setStatusFilters] = useState<StatusFilterMap>(getInitialStatusFilters());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('filename');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [highlightedVideoId, setHighlightedVideoId] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTaskName, setProcessingTaskName] = useState('Processing Videos...');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const cancelProcessingRef = useRef(false);

  const [isPlayerMuted, setIsPlayerMuted] = useState(false); // Start unmuted
  const [volume, setVolume] = useState(1.0); // Start at 100% volume
  const [playbackRate, setPlaybackRate] = useState(1);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);
  const [isFolderSelected, setIsFolderSelected] = useState(false);
  const [currentlyPlayingVideoId, setCurrentlyPlayingVideoId] = useState<string | null>(null);
  const [isLowMemoryMode, setIsLowMemoryMode] = useState(true);
  const [randomSortMap, setRandomSortMap] = useState<Map<string, number> | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  
  const [undoStack, setUndoStack] = useState<HistoryBatch[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryBatch[]>([]);

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [gridSize, setGridSize] = useState(2); // 1=Smallest, 4=Largest

  // New state for player view and playlist
  const [viewMode, setViewMode] = useState<'grid' | 'player'>('grid');
  const [playlist, setPlaylist] = useState<string[]>(getInitialPlaylist()); // Store video IDs
  const [playerCurrentIndex, setPlayerCurrentIndex] = useState<number>(getInitialPlayerIndex());
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
  }, []);
  
  // Persist playlist state
  useEffect(() => {
    try {
        localStorage.setItem('videoLibraryPlaylist', JSON.stringify(playlist));
    } catch (e) {
        console.error("Failed to save playlist to local storage", e);
    }
  }, [playlist]);

  useEffect(() => {
    try {
        localStorage.setItem('videoLibraryPlayerIndex', String(playerCurrentIndex));
    } catch (e) {
        console.error("Failed to save player index to local storage", e);
    }
  }, [playerCurrentIndex]);


  // LRU Cache for scrubbing thumbnails
  const scrubCache: ScrubCache = useMemo(() => {
    const cache = new Map<string, string[]>();
    const maxSize = 150; // Increased to hold more thumbnails for preloading
    
    return {
      get: (key: string): string[] | undefined => {
        const item = cache.get(key);
        if (item) {
          cache.delete(key);
          cache.set(key, item);
        }
        return item;
      },
      set: (key: string, value: string[]) => {
        if (cache.size >= maxSize) {
          const oldestKey = cache.keys().next().value;
          cache.delete(oldestKey);
        }
        cache.set(key, value);
      },
      delete: (key: string) => {
        cache.delete(key);
      },
      clear: () => {
        cache.clear();
      }
    }
  }, []);

  const isFilterActive = useMemo(() => {
      return searchQuery !== '' || selectedTags.length > 0 || statusFilters.size > 0;
  }, [searchQuery, selectedTags, statusFilters]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    videos.forEach(video => video.tags.forEach(tag => tagSet.add(tag)));

    // Explicitly ensure 'Duplicate' tag is present if any video has it.
    if (videos.some(v => v.tags.includes('Duplicate'))) {
      tagSet.add('Duplicate');
    }
    // Explicitly ensure 'Transcoded' tag is present if any video has it.
     if (videos.some(v => v.tags.includes('Transcoded'))) {
      tagSet.add('Transcoded');
    }

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [videos]);
  
  const displayedVideos = useMemo(() => {
    const searchTerms: string[] = [];
    const structuredFilters: string[] = [];

    searchQuery.split(' ').forEach(part => {
        if (part.includes(':') || part.includes('>') || part.includes('<') || part.includes('=')) {
            structuredFilters.push(part.toLowerCase());
        } else if (part) {
            searchTerms.push(part.toLowerCase());
        }
    });

    const textQuery = searchTerms.join(' ');
    
    const parseSize = (s: string): number => {
        s = s.toUpperCase();
        if (s.endsWith('GB')) return parseFloat(s) * 1024 * 1024 * 1024;
        if (s.endsWith('MB')) return parseFloat(s) * 1024 * 1024;
        if (s.endsWith('KB')) return parseFloat(s) * 1024;
        return parseFloat(s);
    };

    const filteredVideos = videos.filter(video => {
      // Status filters
      if (statusFilters.size > 0) {
        let matchesAll = true;
        for (const [filter, mode] of statusFilters.entries()) {
          let conditionMet = false;
          switch (filter) {
            case 'watched': conditionMet = video.seen; break;
            case 'tagged': conditionMet = video.tags.length > 0; break;
            case 'rated': conditionMet = video.rating > 0; break;
            case 'incompatible': conditionMet = !video.isPlayable; break;
            case 'hearted': conditionMet = video.hearted === true; break;
            case 'duplicates': conditionMet = video.tags.includes('Duplicate'); break;
            case 'hidden': conditionMet = video.hidden === true; break;
            case 'deleted': conditionMet = video.deleted === true; break;
            case 'renamed': conditionMet = !!video.title; break;
            case 'not-found': conditionMet = video.notFound === true; break;
          }

          if (mode === 'include' && !conditionMet) {
            matchesAll = false;
            break;
          }
          if (mode === 'exclude' && conditionMet) {
            matchesAll = false;
            break;
          }
        }
        if (!matchesAll) return false;
      } else {
        // Default view: if no filters are active, hide hidden, deleted, and not-found files.
        if (video.hidden || video.deleted || video.notFound) return false;
      }

      // Tag filters
      if (selectedTags.length > 0 && !selectedTags.every(tag => video.tags.includes(tag))) {
        return false;
      }

      // Advanced search query filter
      if (structuredFilters.length > 0) {
          for (const filter of structuredFilters) {
              const filterRegex = /^(rating|size|duration)([:><=])(.+)$/;
              const match = filter.match(filterRegex);
              if (match) {
                  const [, key, op, valStr] = match;
                  const videoVal = {
                      'rating': video.rating,
                      'size': video.fileSize,
                      'duration': video.duration ?? 0,
                  }[key] ?? 0;
                  
                  const numVal = key === 'size' ? parseSize(valStr) : parseFloat(valStr);
                  if (isNaN(numVal)) continue;

                  if (op === '>' && !(videoVal > numVal)) return false;
                  if (op === '<' && !(videoVal < numVal)) return false;
                  if ((op === ':' || op === '=') && videoVal !== numVal) return false;
              }
          }
      }

      // Text search query filter
      if (textQuery) {
        if (!(video.title || video.relativePath).toLowerCase().includes(textQuery) && !video.tags.some(t => t.toLowerCase().includes(textQuery))) {
            return false;
        }
      }

      return true;
    });

    // Sorting
    if (sortCriteria === 'random' && randomSortMap) {
      return [...filteredVideos].sort((a, b) => {
        const valA = randomSortMap.get(a.id) ?? 0.5;
        const valB = randomSortMap.get(b.id) ?? 0.5;
        return valA - valB;
      });
    }
    
    const sorted = [...filteredVideos].sort((a, b) => {
      let comparison = 0;
      switch (sortCriteria) {
        // All comparisons are now ascending by default. The multiplier handles direction.
        case 'rating':
          comparison = (a.rating ?? 0) - (b.rating ?? 0);
          break;
        case 'timesOpened':
          comparison = (a.timesOpened || 0) - (b.timesOpened || 0);
          break;
        case 'dateAdded':
          comparison = (a.dateAdded || 0) - (b.dateAdded || 0);
          break;
        case 'creationTime':
        case 'lastModified':
          comparison = (a.lastModified || 0) - (b.lastModified || 0);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'fileSize':
          comparison = (a.fileSize || 0) - (b.fileSize || 0);
          break;
        case 'path':
          comparison = a.relativePath.localeCompare(b.relativePath);
          break;
        case 'filename':
        default:
          comparison = (a.relativePath.split('/').pop() || a.relativePath)
            .localeCompare(b.relativePath.split('/').pop() || b.relativePath);
          break;
      }
      return comparison * (sortDirection === 'asc' ? 1 : -1);
    });

    return sorted;
  }, [videos, statusFilters, selectedTags, searchQuery, sortCriteria, sortDirection, randomSortMap]);

  const currentVideos = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
    const lastPageIndex = firstPageIndex + VIDEOS_PER_PAGE;
    return displayedVideos.slice(firstPageIndex, lastPageIndex);
  }, [currentPage, displayedVideos]);

  const totalVideoCountForHeader = useMemo(() => videos.filter(v => !v.hidden && !v.deleted).length, [videos]);

  const loadLibraryFromDB = useCallback(async () => {
    setUserMessage(null);
    try {
      const dbVideos = await dbService.getAllVideos();
      setVideos(dbVideos);
    } catch (error) {
      console.error("Failed to load videos from DB", error);
      setUserMessage("Error loading library. The database might be corrupted.");
    }
  }, []);
  
  const getFileForPlayback = useCallback(async (video: VideoData): Promise<File | null> => {
    const file = fileMapRef.current.get(video.relativePath);
    if (file) {
      return file;
    }

    if (fileMapRef.current.size === 0) {
      showToast("Please select your video folder again to grant access.", "info");
      setIsFolderSelected(false);
    } else {
      showToast(`Could not load file: ${video.relativePath}. It may have been moved or deleted. Please re-select the folder.`, 'error');
    }
    return null;
  }, [showToast]);
  
  useEffect(() => {
    const initApp = async () => {
      try {
        await dbService.init();
        const dbVideos = await dbService.getAllVideos();
        if (dbVideos.length > 0) {
          setVideos(dbVideos);
          setIsFolderSelected(false); // User must re-select folder to grant file system access
        }
      } catch (error) {
        console.error("Initialization failed:", error);
        setUserMessage("This browser does not support the necessary features for the app to run.");
      } finally {
        setIsDbReady(true);
      }
    };
    initApp();
  }, []);

  // Reset to first page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilters, selectedTags, searchQuery, sortCriteria, sortDirection]);
  
  // Save status filters to local storage when they change
  useEffect(() => {
    try {
      const filtersToSave = JSON.stringify(Array.from(statusFilters.entries()));
      localStorage.setItem('videoLibraryStatusFilters', filtersToSave);
    } catch (error) {
      console.error("Failed to save status filters to local storage", error);
    }
  }, [statusFilters]);

  // Clear scrub cache when filters or page change, to free memory from irrelevant thumbnails.
  useEffect(() => {
    // This clears timeline thumbnails from memory when they are no longer visible,
    // which helps manage memory usage on large libraries.
    scrubCache.clear();
  }, [statusFilters, selectedTags, searchQuery, currentPage, scrubCache]);

  const handleSelectFolder = () => {
    fileInputRef.current?.click();
  };
  
  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
        return;
    }
    
    const fileList = Array.from(files);
    const newFileMap = new Map<string, File>();
    for (const file of fileList) {
        const path = (file as any).webkitRelativePath;
        if (path) {
            newFileMap.set(path, file);
        }
    }
    fileMapRef.current = newFileMap;

    if (fileMapRef.current.size > 0) {
        await scanFiles(fileList);
        setIsFolderSelected(true);
        setUserMessage(null);
    } else {
        showToast("Could not read folder contents. Please try again.", "error");
    }

    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const scanFiles = async (files: File[]) => {
    setProcessingTaskName('Syncing library...');
    setIsProcessing(true);
    cancelProcessingRef.current = false;

    const fileEntries: { relativePath: string; file: File }[] = files
        .map(file => ({ relativePath: (file as any).webkitRelativePath, file }))
        .filter(entry => entry.relativePath);

    const foundFilePaths = new Set(fileEntries.map(e => e.relativePath));

    const playableExtensions = ['.mp4', '.ogv'];
    const videosForThumbGen: VideoData[] = [];

    const existingVideos = await dbService.getAllVideos();
    const existingThumbnails = await dbService.getAllMainThumbnails();
    const existingVideosMap = new Map(existingVideos.map(v => [v.relativePath, v]));

    const videosToBatchUpdate: VideoData[] = [];

    setTotalToProcess(fileEntries.length + existingVideos.length);
    setProcessedCount(0);

    // 1. Process found files
    for (const { relativePath, file } of fileEntries) {
        if (cancelProcessingRef.current) break;

        const existingVideo = existingVideosMap.get(relativePath);
        const lowerCaseName = file.name.toLowerCase();
        const isJpg = lowerCaseName.endsWith('.jpg');
        const isNativelyPlayable = playableExtensions.some(ext => lowerCaseName.endsWith(ext)) || !file.name.includes('.');
        const isPlayable = isNativelyPlayable;

        let needsUpdate = false;
        let needsThumbProcessing = false;
        
        // Deferring duration check for much faster scanning.
        // It can be run later from the settings menu.
        const newDuration: number | null = existingVideo?.duration || null;

        if (!existingVideo || existingVideo.lastModified !== file.lastModified || existingVideo.notFound) {
            needsUpdate = true;
            if (isPlayable) {
                needsThumbProcessing = true;
            }
        } else if (isPlayable && !existingThumbnails.has(existingVideo.id)) {
            needsThumbProcessing = true; // Still need to generate thumbnail for existing entry
            needsUpdate = true; // Mark for update to ensure consistency
        }
        
        if (needsUpdate) {
            const videoData: VideoData = {
                id: existingVideo?.id || crypto.randomUUID(),
                relativePath,
                rating: existingVideo?.rating || 0,
                seen: existingVideo?.seen || false,
                tags: existingVideo?.tags || [],
                fileSize: file.size,
                duration: newDuration,
                lastModified: file.lastModified,
                dateAdded: existingVideo?.dateAdded || Date.now(),
                timesOpened: existingVideo?.timesOpened || 0,
                hearted: existingVideo?.hearted || false,
                hidden: existingVideo?.hidden || isJpg,
                deleted: existingVideo?.deleted || false,
                title: existingVideo?.title,
                currentTime: existingVideo?.currentTime,
                isPlayable: isPlayable,
                notFound: false,
                description: isPlayable ? 'Generating thumbnails...' : (isJpg ? 'JPG Image' : 'Incompatible file format.'),
                thumbnail: null,
            };
            videosToBatchUpdate.push(videoData);
            if (needsThumbProcessing) {
                videosForThumbGen.push(videoData);
            }
        } else if (existingVideo.duration !== newDuration && newDuration !== null) {
              videosToBatchUpdate.push({ ...existingVideo, duration: newDuration, notFound: false });
        }
        
        setProcessedCount(p => p + 1);
    }
    
    if (cancelProcessingRef.current) {
        setIsProcessing(false);
        return;
    }
    
    // 2. Mark not found files
    for (const video of existingVideos) {
        if (!foundFilePaths.has(video.relativePath)) {
            if (!video.notFound) {
                videosToBatchUpdate.push({ ...video, notFound: true });
            }
        }
        setProcessedCount(p => p + 1);
    }
    
    if (cancelProcessingRef.current) {
        setIsProcessing(false);
        return;
    }

    // 3. Batch update DB
    if (videosToBatchUpdate.length > 0) {
        setProcessingTaskName('Saving library changes...');
        await dbService.batchUpdateVideos(videosToBatchUpdate);
    }

    await loadLibraryFromDB();

    if (videosForThumbGen.length > 0 && !cancelProcessingRef.current) {
        processInBackground(videosForThumbGen);
    } else {
        setIsProcessing(false);
        cancelProcessingRef.current = false;
    }
  };
  
  const processInBackground = async (videosToProcess: VideoData[]) => {
    setIsProcessing(true);
    setTotalToProcess(videosToProcess.length);
    setProcessingTaskName('Generating thumbnails...');
    setProcessedCount(0);
    cancelProcessingRef.current = false;

    // This loop processes each video sequentially to avoid high memory usage.
    // State is not updated inside the loop to prevent performance issues from frequent re-renders.
    for (const video of videosToProcess) {
        if (cancelProcessingRef.current) break;
        
        const file = fileMapRef.current.get(video.relativePath);
        if (file) {
            const thumbnail = await videoService.generateThumbnail(file);
            const isNowPlayable = thumbnail !== null;
            const description = isNowPlayable ? '' : 'Could not generate thumbnail. File may be corrupt or in an unsupported format.';
            
            // The thumbnail is saved directly to the database.
            const updatedVideoForDB: VideoData = {
                ...video,
                description,
                thumbnail,
                isPlayable: isNowPlayable,
            };
            await dbService.updateVideo(updatedVideoForDB);
        }
        setProcessedCount(prev => prev + 1);
    }
    
    // After all processing, reload from the database to get all updates at once.
    // This is a single, efficient state update.
    await loadLibraryFromDB();
    
    setIsProcessing(false);
    cancelProcessingRef.current = false;
  };
  
  const handleUpdateVideo = useCallback(async (updatedVideo: VideoData) => {
    if (isBatchEditMode) {
      const previousState = videos.find(v => v.id === updatedVideo.id);
      if (!previousState) return; // Should not happen

      const videosToUpdate: VideoData[] = [];
      const historyBatch: HistoryBatch = [];
      const targets = displayedVideos;

      const changes: Partial<VideoData> = {};
      (Object.keys(updatedVideo) as Array<keyof VideoData>).forEach(key => {
        if (JSON.stringify(previousState[key]) !== JSON.stringify(updatedVideo[key])) {
          if (!['id', 'currentTime', 'timesOpened', 'relativePath', 'fileSize', 'duration', 'lastModified', 'dateAdded', 'isPlayable', 'notFound'].includes(key)) {
            (changes as any)[key] = updatedVideo[key];
          }
        }
      });
      
      // Special case: if play time is > 1s, mark as seen.
      if (updatedVideo.currentTime && updatedVideo.currentTime > 1 && !previousState.seen) {
        changes.seen = true;
      }
      
      if (Object.keys(changes).length === 0) return;

      targets.forEach(targetVideo => {
        historyBatch.push({ videoId: targetVideo.id, state: targetVideo });
        const newVideoData = { ...targetVideo, ...changes };
        videosToUpdate.push(newVideoData);
      });

      if (videosToUpdate.length > 0) {
        await dbService.batchUpdateVideos(videosToUpdate);
        const updatesMap = new Map(videosToUpdate.map(v => [v.id, v]));
        setVideos(prev => prev.map(v => updatesMap.get(v.id) || v));
        setUndoStack(prev => [...prev, historyBatch]);
        setRedoStack([]);
        showToast(`Applied changes to ${videosToUpdate.length} videos.`, 'success');
      }
    } else {
      const previousState = videos.find(v => v.id === updatedVideo.id);
      
      if (previousState) {
        if (updatedVideo.currentTime && updatedVideo.currentTime > 1 && !previousState.seen) {
          updatedVideo.seen = true;
        }

        if (JSON.stringify(previousState) !== JSON.stringify(updatedVideo)) {
            setUndoStack(prev => [...prev, [{ videoId: updatedVideo.id, state: previousState }]]);
            setRedoStack([]);
        }
      }
      
      await dbService.updateVideo(updatedVideo);
      setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
    }
  }, [videos, isBatchEditMode, displayedVideos, showToast]);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const newUndoStack = [...undoStack];
    const lastActionBatch = newUndoStack.pop();
    if (!lastActionBatch) return;

    const currentStatesForRedo: HistoryBatch = lastActionBatch.map(
        change => ({ videoId: change.videoId, state: videos.find(v => v.id === change.videoId)! })
    ).filter((item): item is HistoryEntry => !!item.state);

    if (currentStatesForRedo.length > 0) {
        setRedoStack(prev => [...prev, currentStatesForRedo]);
    }

    await dbService.batchUpdateVideos(lastActionBatch.map(c => c.state));
    const updatesMap = new Map(lastActionBatch.map(c => [c.videoId, c.state]));
    setVideos(prev => prev.map(v => updatesMap.get(v.id) || v));
    setUndoStack(newUndoStack);
  }, [undoStack, videos]);

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const lastActionBatch = newRedoStack.pop();
    if (!lastActionBatch) return;

    const currentStatesForUndo: HistoryBatch = lastActionBatch.map(
        change => ({ videoId: change.videoId, state: videos.find(v => v.id === change.videoId)! })
    ).filter((item): item is HistoryEntry => !!item.state);

    if (currentStatesForUndo.length > 0) {
      setUndoStack(prev => [...prev, currentStatesForUndo]);
    }

    await dbService.batchUpdateVideos(lastActionBatch.map(c => c.state));
    const updatesMap = new Map(lastActionBatch.map(c => [c.videoId, c.state]));
    setVideos(prev => prev.map(v => updatesMap.get(v.id) || v));
    setRedoStack(newRedoStack);
  }, [redoStack, videos]);


  const handleRegenerateThumbnails = useCallback(async (videoToRegen: VideoData) => {
    const file = await getFileForPlayback(videoToRegen);
    if (!file) {
        const errorMsg = "Auto-regeneration failed for " + videoToRegen.relativePath + "\nFile not available. Please re-select folder.";
        console.error(errorMsg);
        setVideos(prev => prev.map(v => v.id === videoToRegen.id ? { ...v, description: errorMsg } : v));
        return;
    }
    
    await dbService.deleteTimelineThumbnails(videoToRegen.id);
    scrubCache.delete(videoToRegen.id);

    setVideos(prev => prev.map(v => v.id === videoToRegen.id ? { ...v, description: "Generating thumbnails...", thumbnail: null } : v));

    try {
        const thumbnail = await videoService.generateThumbnail(file);
        const isNowPlayable = thumbnail !== null;
        
        const updatedVideo: VideoData = {
            ...videoToRegen,
            thumbnail,
            description: isNowPlayable ? "" : "Failed to regenerate thumbnail.",
            isPlayable: isNowPlayable,
        };
        
        await dbService.updateVideo(updatedVideo);
        // We load from DB after processing multiple files, so for single regen, update state directly.
        await loadLibraryFromDB();

    } catch (e) {
        console.error("Error during manual regeneration:", e);
        const errorUpdate = { ...videoToRegen, description: "Failed to regenerate thumbnail." };
        await dbService.updateVideo(errorUpdate);
        setVideos(prev => prev.map(v => v.id === videoToRegen.id ? { ...v, description: "Failed to regenerate thumbnail." } : v));
        throw e;
    }
  }, [getFileForPlayback, scrubCache, loadLibraryFromDB]);

  const handleRefreshLibrary = useCallback(async () => {
    setUserMessage('Refreshing library...');
    await loadLibraryFromDB();
    if(sortCriteria === 'random') {
      const newMap = new Map<string, number>();
      videos.forEach(v => newMap.set(v.id, Math.random()));
      setRandomSortMap(newMap);
    }
    fileMapRef.current.clear();
    setIsFolderSelected(false);
    setUserMessage(null);
  }, [sortCriteria, loadLibraryFromDB, videos]);

  const handleGoToRandom = useCallback(() => {
    const playableVideos = displayedVideos.filter(v => v.isPlayable);
    if (playableVideos.length === 0) return;
    const randomIndex = Math.floor(Math.random() * playableVideos.length);
    const randomVideo = playableVideos[randomIndex];
    
    const videoIndex = displayedVideos.findIndex(v => v.id === randomVideo.id);
    if (videoIndex !== -1) {
      const page = Math.floor(videoIndex / VIDEOS_PER_PAGE) + 1;
      setCurrentPage(page);
    }
    
    setTimeout(() => {
        const element = document.getElementById(randomVideo.id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedVideoId(randomVideo.id);
          setTimeout(() => setHighlightedVideoId(null), 2500);
        }
    }, 100);

  }, [displayedVideos]);
  
  const handleResetFilters = useCallback(() => {
    setStatusFilters(new Map());
    setSelectedTags([]);
    setSearchQuery('');
  }, []);

  const handleStatusFilterToggle = useCallback((filter: StatusFilter) => {
    setStatusFilters(prev => {
        const newFilters = new Map(prev);
        const currentState = newFilters.get(filter);

        if (currentState === 'include') {
            newFilters.set(filter, 'exclude');
        } else if (currentState === 'exclude') {
            newFilters.delete(filter);
        } else {
            newFilters.set(filter, 'include');
        }
        
        return newFilters;
    });
  }, []);

  const handleClearStatusFilters = useCallback(() => {
    setStatusFilters(new Map());
  }, []);

  const handleSortCriteriaChange = (criteria: SortCriteria) => {
    if (criteria === 'random' && sortCriteria !== 'random') {
      const newMap = new Map<string, number>();
      videos.forEach(v => newMap.set(v.id, Math.random()));
      setRandomSortMap(newMap);
    } else if (criteria !== 'random') {
      setRandomSortMap(null);
    }
    setSortCriteria(criteria);
  };

  const handleSortDirectionToggle = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleGridSizeChange = (size: number) => {
    setGridSize(Math.max(1, Math.min(4, size)));
  };

  const handleBatchEditModeChange = (enabled: boolean) => {
    setIsBatchEditMode(enabled);
  };
  
  const handleAddToPlaylist = useCallback((videoId: string) => {
    setPlaylist(prev => {
      if (prev.includes(videoId)) {
        showToast('Video already in playlist.', 'info');
        return prev;
      }
      showToast('Video added to playlist.', 'success');
      return [...prev, videoId];
    });
  }, [showToast]);

  const handleViewPlayer = () => {
    if (playlist.length > 0) {
      setViewMode('player');
    }
  };

  const handleExitPlayer = () => {
    setViewMode('grid');
  };

  const handleUpdatePlaylist = (newIds: string[]) => {
    setPlaylist(newIds);
  };

  const handleExportPlaylist = () => {
    const playlistData = JSON.stringify(playlist, null, 2);
    const blob = new Blob([playlistData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Playlist exported!', 'success');
  };

  const handleImportPlaylist = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const importedIds = JSON.parse(text);
          if (Array.isArray(importedIds) && importedIds.every(id => typeof id === 'string')) {
            const validIds = importedIds.filter(id => videos.some(v => v.id === id));
            setPlaylist(validIds);
            showToast(`Imported ${validIds.length} videos to playlist.`, 'success');
          } else {
            showToast('Invalid playlist file format.', 'error');
          }
        } catch (error) {
          showToast('Failed to import playlist.', 'error');
          console.error('Playlist import error:', error);
        }
      }
    };
    input.click();
  };
  
  const handleClearPlaylist = () => {
    setPlaylist([]);
    showToast('Playlist cleared.', 'success');
  };
  
  const handleExportDB = async () => {
    try {
      const data = await dbService.exportData();
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video-library-backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Database exported successfully!', 'success');
    } catch(e) {
      console.error("DB Export failed", e);
      showToast('Database export failed.', 'error');
    }
  };

  const handleExportSelected = () => {
    const dataToExport = displayedVideos.map(({ id, relativePath, rating, tags, seen, hearted, hidden, title }) => ({
      id, relativePath, rating, tags, seen, hearted, hidden, title
    }));
    const jsonData = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selection-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Selected videos data exported!', 'success');
  };

  const handleScanDurations = async () => {
    const videosWithoutDuration = videos.filter(v => (v.duration === null || v.duration === 0) && v.isPlayable);
    if (videosWithoutDuration.length === 0) {
      showToast('All playable videos have durations.', 'info');
      return;
    }
    
    setIsProcessing(true);
    setTotalToProcess(videosWithoutDuration.length);
    setProcessingTaskName('Scanning durations...');
    setProcessedCount(0);
    cancelProcessingRef.current = false;

    for (const video of videosWithoutDuration) {
      if (cancelProcessingRef.current) break;
      const file = await getFileForPlayback(video);
      if(file) {
        const duration = await videoService.getVideoDuration(file);
        if (duration) {
          const updatedVideo = { ...video, duration };
          await dbService.updateVideo(updatedVideo);
        }
      }
      setProcessedCount(p => p + 1);
    }
    await loadLibraryFromDB();
    setIsProcessing(false);
    showToast('Duration scan complete.', 'success');
  };
  
  const handleFindDuplicates = async () => {
    setProcessingTaskName('Finding duplicates...');
    setIsProcessing(true);
    setTotalToProcess(videos.length);
    setProcessedCount(0);
    
    const sizeAndDurationMap = new Map<string, VideoData[]>();
    for (const video of videos) {
      if (!video.duration || video.deleted || video.hidden) continue;
      const key = `${video.fileSize}:${Math.round(video.duration)}`;
      if (!sizeAndDurationMap.has(key)) {
        sizeAndDurationMap.set(key, []);
      }
      sizeAndDurationMap.get(key)!.push(video);
      setProcessedCount(p => p+1);
    }

    const videosToUpdate: VideoData[] = [];
    for (const [, potentialDuplicates] of sizeAndDurationMap.entries()) {
      if (potentialDuplicates.length > 1) {
        potentialDuplicates.forEach(video => {
          if (!video.tags.includes('Duplicate')) {
            videosToUpdate.push({ ...video, tags: [...video.tags, 'Duplicate'].sort() });
          }
        });
      }
    }
    
    if (videosToUpdate.length > 0) {
        await dbService.batchUpdateVideos(videosToUpdate);
        await loadLibraryFromDB();
        showToast(`Found and tagged ${videosToUpdate.length} potential duplicates.`, 'success');
    } else {
        showToast('No new duplicates found.', 'info');
    }

    setIsProcessing(false);
  };

  const handleFindTranscoded = async () => {
    setProcessingTaskName('Finding transcoded files...');
    setIsProcessing(true);
    setTotalToProcess(videos.length);
    setProcessedCount(0);

    const pathMap = new Map<string, VideoData[]>();
    for (const video of videos) {
      const lastDotIndex = video.relativePath.lastIndexOf('.');
      const pathWithoutExt = lastDotIndex !== -1 ? video.relativePath.substring(0, lastDotIndex) : video.relativePath;
      if (!pathMap.has(pathWithoutExt)) {
        pathMap.set(pathWithoutExt, []);
      }
      pathMap.get(pathWithoutExt)!.push(video);
      setProcessedCount(p => p+1);
    }
    
    const videosToUpdate: VideoData[] = [];
    for (const [, candidates] of pathMap.entries()) {
      if (candidates.length > 1) {
        const hasMp4 = candidates.some(v => v.relativePath.toLowerCase().endsWith('.mp4'));
        if (hasMp4) {
          candidates.forEach(v => {
            if (transcodeService.isTranscodable(v.relativePath) && !v.tags.includes('Transcoded')) {
              videosToUpdate.push({ ...v, tags: [...v.tags, 'Transcoded'].sort() });
            }
          });
        }
      }
    }
    
    if (videosToUpdate.length > 0) {
        await dbService.batchUpdateVideos(videosToUpdate);
        await loadLibraryFromDB();
        showToast(`Found and tagged ${videosToUpdate.length} potential transcoded source files.`, 'success');
    } else {
        showToast('No new transcoded source files found.', 'info');
    }

    setIsProcessing(false);
  };
  
  const handleResetDuplicates = async () => {
    const videosToUpdate = videos
      .filter(v => v.tags.includes('Duplicate'))
      .map(v => ({ ...v, tags: v.tags.filter(t => t !== 'Duplicate') }));
    
    if (videosToUpdate.length > 0) {
      await dbService.batchUpdateVideos(videosToUpdate);
      await loadLibraryFromDB();
      showToast('Removed "Duplicate" tag from all videos.', 'success');
    } else {
      showToast('No videos were tagged as "Duplicate".', 'info');
    }
  };

  const handleUnheartAllVideos = async () => {
    const videosToUpdate = videos
      .filter(v => v.hearted)
      .map(v => ({...v, hearted: false }));

    if (videosToUpdate.length > 0) {
      await dbService.batchUpdateVideos(videosToUpdate);
      await loadLibraryFromDB();
      showToast(`Unhearted ${videosToUpdate.length} videos.`, 'success');
    } else {
      showToast('No videos were hearted.', 'info');
    }
  };

  const handleUnhideAllVideos = async () => {
    const videosToUpdate = videos
      .filter(v => v.hidden)
      .map(v => ({...v, hidden: false }));
    
    if (videosToUpdate.length > 0) {
      await dbService.batchUpdateVideos(videosToUpdate);
      await loadLibraryFromDB();
      showToast(`Unhid ${videosToUpdate.length} videos.`, 'success');
    } else {
      showToast('No videos were hidden.', 'info');
    }
  };
  
  const handleResetDatabase = async () => {
    await dbService.clearAllData();
    setVideos([]);
    fileMapRef.current.clear();
    setPlaylist([]);
    setPlayerCurrentIndex(0);
    setUndoStack([]);
    setRedoStack([]);
    setIsFolderSelected(false);
    showToast('Database has been reset.', 'success');
  };

  const cancelProcessing = () => {
    cancelProcessingRef.current = true;
    setIsProcessing(false);
  };
  
  const renderContent = () => {
    if (viewMode === 'player') {
      return (
        <PlayerView
          playlistIds={playlist}
          allVideos={videos}
          onUpdateVideo={handleUpdateVideo}
          getVideoFile={getFileForPlayback}
          onExit={handleExitPlayer}
          onUpdatePlaylist={handleUpdatePlaylist}
          allTags={allTags}
          isMuted={isPlayerMuted}
          onMuteChange={setIsPlayerMuted}
          volume={volume}
          onVolumeChange={setVolume}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          scrubCache={scrubCache}
          currentIndex={playerCurrentIndex}
          onSetCurrentIndex={setPlayerCurrentIndex}
        />
      );
    }
  
    const hasVideos = videos.length > 0;
    const shouldShowWelcome = !hasVideos && !isFolderSelected;
    const shouldShowSelectFolder = hasVideos && !isFolderSelected;

    return (
      <>
        <Header
          onSelectClick={handleSelectFolder}
          onRandomClick={handleGoToRandom}
          onResetFilters={handleResetFilters}
          isFilterActive={isFilterActive}
          activeStatusFilters={statusFilters}
          onStatusFilterToggle={handleStatusFilterToggle}
          onClearStatusFilters={handleClearStatusFilters}
          videoCount={totalVideoCountForHeader}
          filteredVideoCount={displayedVideos.length}
          hasVideos={hasVideos}
          allTags={allTags}
          selectedTags={selectedTags}
          onSetSelectedTags={setSelectedTags}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLowMemoryMode={isLowMemoryMode}
          onToggleLowMemoryMode={setIsLowMemoryMode}
          sortCriteria={sortCriteria}
          onSortCriteriaChange={handleSortCriteriaChange}
          sortDirection={sortDirection}
          onSortDirectionToggle={handleSortDirectionToggle}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          gridSize={gridSize}
          onGridSizeChange={handleGridSizeChange}
          isBatchEditMode={isBatchEditMode}
          onBatchEditModeChange={handleBatchEditModeChange}
          playlistCount={playlist.length}
          onViewPlayer={handleViewPlayer}
          onExportPlaylist={handleExportPlaylist}
          onImportPlaylist={handleImportPlaylist}
          onClearPlaylist={handleClearPlaylist}
          onRefreshLibrary={handleRefreshLibrary}
          onExportDB={handleExportDB}
          onExportSelected={handleExportSelected}
          onScanDurations={handleScanDurations}
          onFindDuplicates={handleFindDuplicates}
          onFindTranscoded={handleFindTranscoded}
          onResetDuplicates={handleResetDuplicates}
          onUnheartAllVideos={handleUnheartAllVideos}
          onUnhideAllVideos={handleUnhideAllVideos}
          onResetDatabase={handleResetDatabase}
          currentPage={currentPage}
          totalPages={Math.ceil(displayedVideos.length / VIDEOS_PER_PAGE)}
          onPageChange={setCurrentPage}
        />

        <main className="container mx-auto p-4 lg:p-6 flex-grow">
          {shouldShowWelcome && <WelcomeScreen onSelectClick={handleSelectFolder} />}
          {shouldShowSelectFolder && <SelectFolderScreen onSelectClick={handleSelectFolder} videoCount={videos.length} />}
          {hasVideos && isFolderSelected && (
            <VideoGrid
              videos={currentVideos}
              onUpdate={handleUpdateVideo}
              allTags={allTags}
              isMuted={isPlayerMuted}
              onMuteChange={setIsPlayerMuted}
              volume={volume}
              onVolumeChange={setVolume}
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
              highlightedVideoId={highlightedVideoId}
              getVideoFile={getFileForPlayback}
              onRegenerate={handleRegenerateThumbnails}
              currentlyPlayingVideoId={currentlyPlayingVideoId}
              onSetPlayingVideoId={setCurrentlyPlayingVideoId}
              scrubCache={scrubCache}
              isLowMemoryMode={isLowMemoryMode}
              preloadThumbnails={gridSize < 3}
              gridSize={gridSize}
              onAddToPlaylist={handleAddToPlaylist}
            />
          )}
        </main>

        {isFolderSelected && displayedVideos.length > VIDEOS_PER_PAGE && (
           <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(displayedVideos.length / VIDEOS_PER_PAGE)}
              onPageChange={setCurrentPage}
           />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
        webkitdirectory=""
        directory=""
        multiple
      />

      {!isDbReady && <LoadingOverlay message="Initializing Database..." />}
      {userMessage && <div className="p-4 text-center bg-red-800 text-white">{userMessage}</div>}

      {isDbReady && renderContent()}
      
      {isProcessing && (
        <ProcessingStatusBar
          processedCount={processedCount}
          totalCount={totalToProcess}
          onCancel={cancelProcessing}
          taskName={processingTaskName}
        />
      )}
      <Toast message={toastMessage} type={toastType} onDismiss={() => setToastMessage('')} />
    </div>
  );
}

export default App;