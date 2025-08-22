import { VideoData } from '../types';

const DB_NAME = 'vidlibman.db';
const DB_VERSION = 7; // Incremented version for new features
const STORES = {
  VIDEOS: 'videos',
  MAIN_THUMBNAILS: 'main_thumbnails',
  TIMELINE_THUMBNAILS: 'timeline_thumbnails',
};

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error("Error opening DB"));
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      
      // All new fields are optional, so no complex migration is needed.
      // Existing objects will get default values from applyVideoDefaults.
      if (event.oldVersion < 3) {
          if (!dbInstance.objectStoreNames.contains(STORES.VIDEOS)) {
              const videoStore = dbInstance.createObjectStore(STORES.VIDEOS, { keyPath: 'id' });
              videoStore.createIndex('relativePath', 'relativePath', { unique: true });
          }
          if (dbInstance.objectStoreNames.contains('config')) {
              dbInstance.deleteObjectStore('config');
          }
      }
      
      if (event.oldVersion < 4) {
          if (!dbInstance.objectStoreNames.contains(STORES.MAIN_THUMBNAILS)) {
              dbInstance.createObjectStore(STORES.MAIN_THUMBNAILS, { keyPath: 'videoId' });
          }
          if (dbInstance.objectStoreNames.contains('thumbnails')) {
              dbInstance.deleteObjectStore('thumbnails');
          }
      }

      if (event.oldVersion < 5) {
          if (dbInstance.objectStoreNames.contains('timeline_thumbnails')) {
              dbInstance.deleteObjectStore('timeline_thumbnails');
          }
      }
      
      if (event.oldVersion < 6) {
          if (!dbInstance.objectStoreNames.contains(STORES.TIMELINE_THUMBNAILS)) {
              dbInstance.createObjectStore(STORES.TIMELINE_THUMBNAILS, { keyPath: 'videoId' });
          }
      }
      // Version 7: No schema changes, just application logic changes.
    };
  });
};

const getStore = (storeName: string, mode: IDBTransactionMode) => {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

// Helper to provide default values for backward compatibility
const applyVideoDefaults = (video: any): VideoData => {
  return {
    ...video,
    thumbnail: null, // Always null on initial load, fetched later
    rating: video.rating ?? 0,
    seen: video.seen ?? false,
    tags: video.tags ?? [],
    timesOpened: video.timesOpened || 0,
    dateAdded: video.dateAdded || video.lastModified || 0,
    hearted: video.hearted || false,
    hidden: video.hidden || false,
    title: video.title, // Can be undefined
    contentHash: video.contentHash || null,
    currentTime: video.currentTime, // Add the new field
    notFound: video.notFound || false,
  };
};

export const dbService = {
  init: async () => {
    if (!('indexedDB' in window)) {
        throw new Error("IndexedDB not supported!");
    }
    db = await openDB();
  },
  
  upsertVideo: async (video: VideoData): Promise<void> => {
    return new Promise((resolve, reject) => {
        const { thumbnail, ...videoMetadata } = video;
        
        const tx = db.transaction([STORES.VIDEOS, STORES.MAIN_THUMBNAILS], 'readwrite');
        const videoStore = tx.objectStore(STORES.VIDEOS);
        const mainThumbStore = tx.objectStore(STORES.MAIN_THUMBNAILS);

        videoStore.put(videoMetadata);
        
        if (thumbnail !== null) {
            mainThumbStore.put({ videoId: video.id, thumbnail });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = (event) => {
            console.error("Upsert transaction error:", (event.target as IDBRequest).error);
            reject(new Error("Upsert transaction failed"));
        }
    });
  },

  updateVideo: async (video: VideoData): Promise<void> => {
    await dbService.upsertVideo(video);
  },
  
  batchUpdateVideos: async (videos: VideoData[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (videos.length === 0) return resolve();
      const tx = db.transaction([STORES.VIDEOS], 'readwrite');
      const store = tx.objectStore(STORES.VIDEOS);

      videos.forEach(video => {
        const { thumbnail, ...videoMetadata } = video;
        store.put(videoMetadata);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = (event) => {
        console.error("Batch update transaction error:", (event.target as IDBRequest).error);
        reject(new Error("Batch update transaction failed"));
      };
    });
  },

  getMainThumbnail: async (videoId: string): Promise<{ thumbnail: string | null } | null> => {
      return new Promise((resolve, reject) => {
          const store = getStore(STORES.MAIN_THUMBNAILS, 'readonly');
          const request = store.get(videoId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error('Failed to fetch main thumbnail'));
      });
  },

  getAllMainThumbnails: async (): Promise<Map<string, { thumbnail: string | null }>> => {
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MAIN_THUMBNAILS, 'readonly');
      const request = store.getAll();
      request.onsuccess = () => {
        const results: { videoId: string; thumbnail: string | null }[] = request.result;
        const map = new Map<string, { thumbnail: string | null }>();
        for (const item of results) {
          map.set(item.videoId, { thumbnail: item.thumbnail });
        }
        resolve(map);
      };
      request.onerror = () => reject(new Error('Failed to fetch all main thumbnails'));
    });
  },

  getTimelineThumbnails: async (videoId: string): Promise<{ thumbnails: string[] } | null> => {
      return new Promise((resolve, reject) => {
          const store = getStore(STORES.TIMELINE_THUMBNAILS, 'readonly');
          const request = store.get(videoId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error('Failed to fetch timeline thumbnails'));
      });
  },

  setTimelineThumbnails: async (videoId: string, thumbnails: string[]): Promise<void> => {
      return new Promise((resolve, reject) => {
          const store = getStore(STORES.TIMELINE_THUMBNAILS, 'readwrite');
          const request = store.put({ videoId, thumbnails });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new Error('Failed to save timeline thumbnails'));
      });
  },

  deleteTimelineThumbnails: async (videoId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
          const store = getStore(STORES.TIMELINE_THUMBNAILS, 'readwrite');
          const request = store.delete(videoId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new Error('Failed to delete timeline thumbnails'));
      });
  },

  getVideoByRelativePath: async (relativePath: string): Promise<VideoData | null> => {
     return new Promise(async (resolve, reject) => {
        const videoStore = getStore(STORES.VIDEOS, 'readonly');
        const index = videoStore.index('relativePath');
        const request = index.get(relativePath);

        request.onsuccess = async () => {
            const videoMetadata = request.result;
            if (!videoMetadata) {
                return resolve(null);
            }
            resolve(applyVideoDefaults(videoMetadata));
        };
        request.onerror = () => reject(new Error("Failed to get video by relative path"));
    });
  },

  getAllVideos: async (): Promise<VideoData[]> => {
    return new Promise(async (resolve, reject) => {
      const videoStore = getStore(STORES.VIDEOS, 'readonly');
      const videoRequest = videoStore.getAll();

      videoRequest.onsuccess = async () => {
        const videos: any[] = videoRequest.result;
        const videosWithDefaults = videos.map(applyVideoDefaults);
        resolve(videosWithDefaults);
      };
      videoRequest.onerror = () => reject(new Error("Failed to fetch videos"));
    });
  },
  
  exportData: async (): Promise<Record<string, any[]>> => {
    const data: Record<string, any[]> = {};
    const storeNames = Object.values(STORES);
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readonly');
      let count = 0;
      
      tx.oncomplete = () => resolve(data);
      tx.onerror = (e) => reject(new Error(`Export failed: ${(e.target as IDBRequest).error}`));
      
      for(const storeName of storeNames) {
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          data[storeName] = request.result;
          count++;
          if (count === storeNames.length) {
            // This is a workaround, as oncomplete should fire, but to be safe.
            resolve(data);
          }
        };
      }
    });
  },

  clearAllData: async (): Promise<void> => {
    return new Promise(async(resolve, reject) => {
       const tx = db.transaction([STORES.VIDEOS, STORES.MAIN_THUMBNAILS, STORES.TIMELINE_THUMBNAILS], 'readwrite');
       tx.objectStore(STORES.VIDEOS).clear();
       tx.objectStore(STORES.MAIN_THUMBNAILS).clear();
       tx.objectStore(STORES.TIMELINE_THUMBNAILS).clear();

       tx.oncomplete = () => resolve();
       tx.onerror = () => reject(new Error("Failed to clear data"));
    });
  }
};