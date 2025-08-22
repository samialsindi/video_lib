






const isDataUrlBlack = (dataUrl: string): Promise<boolean> => {
    return new Promise(resolve => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                // Check a small version for performance
                const checkWidth = 20;
                const checkHeight = Math.round(img.height * (checkWidth / img.width));
                canvas.width = checkWidth;
                canvas.height = checkHeight;
                
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    return resolve(false);
                }
                ctx.drawImage(img, 0, 0, checkWidth, checkHeight);
                const imageData = ctx.getImageData(0, 0, checkWidth, checkHeight).data;
                
                for (let i = 0; i < imageData.length; i += 4) {
                    // Check RGB, give a small threshold for "blackness"
                    if (imageData[i] > 15 || imageData[i + 1] > 15 || imageData[i + 2] > 15) {
                        return resolve(false); // Found a non-black pixel
                    }
                }
                return resolve(true); // All pixels are black
            } catch (e) {
                console.error("Error checking if image is black:", e);
                return resolve(false);
            }
        };
        img.onerror = () => resolve(false); // If it fails to load, it's not a black image
    });
};

const getResizedDimensions = (width: number, height: number, maxDimension: number) => {
    if (width > maxDimension || height > maxDimension) {
        if (width > height) {
            const newHeight = Math.round(height * (maxDimension / width));
            return { width: maxDimension, height: newHeight };
        } else {
            const newWidth = Math.round(width * (maxDimension / height));
            return { width: newWidth, height: maxDimension };
        }
    }
    return { width, height };
}


const seekAndCapture = (video: HTMLVideoElement, time: number, canvas: HTMLCanvasElement): Promise<string | null> => {
  return new Promise((resolve) => {
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error(`Timeout seeking to ${time}s for ${video.src}`);
        cleanup();
        resolve(null);
      }
    }, 45000); // 45 second timeout for more flexibility with large files

    const cleanup = () => {
      video.removeEventListener('seeked', onReadyToCapture);
      video.removeEventListener('canplay', onReadyToCapture);
      video.removeEventListener('error', onError);
      clearTimeout(timeoutId);
    };
    
    const onReadyToCapture = () => {
      if (resolved) return;
      resolved = true; // Prevent multiple triggers
      
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Could not get canvas context for thumbnail generation.');
          cleanup();
          return resolve(null);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        console.error("Canvas drawImage error:", e);
        cleanup();
        resolve(null);
      }
    };

    const onError = (e: Event | string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      console.error(`Error seeking to ${time}s: ${e instanceof Event ? (e.target as HTMLVideoElement).error?.message : e}`);
      resolve(null);
    };
    
    video.addEventListener('seeked', onReadyToCapture);
    video.addEventListener('canplay', onReadyToCapture); // Using canplay as a fallback for seeked
    video.addEventListener('error', onError);

    video.currentTime = time;
  });
};

export const videoService = {
  isDataUrlBlack,
  formatBytes: (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  getVideoDuration: (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(objectUrl);
      };

      const onLoadedMetadata = () => {
        cleanup();
        resolve(video.duration);
      };

      const onError = () => {
        cleanup();
        console.error(`Could not load metadata for duration check: ${file.name}`);
        resolve(null);
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);
    });
  },

  generateThumbnail: (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      // Allow attempting thumbnail generation even if mime type is unknown
      // for files without extensions.
      if (file.type && !file.type.startsWith('video/')) {
        return resolve(null);
      }

      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.muted = true;
      video.crossOrigin = "anonymous";

      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(objectUrl);
      };

      const onLoadedData = () => {
        video.currentTime = 1; // Seek to 1 second
      };

      const onSeeked = () => {
        const { width, height } = getResizedDimensions(video.videoWidth, video.videoHeight, 512); // Back to 512
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return resolve(null);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // Less heavy compression
      };

      const onError = () => {
        cleanup();
        resolve(null);
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
    });
  },

  generateTimelineThumbnails: (file: File, count: number = 10): Promise<string[] | null> => {
    return new Promise((resolve) => {
       if (file.type && !file.type.startsWith('video/')) {
        return resolve(null);
      }

      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.muted = true;
      video.preload = 'metadata';
      video.crossOrigin = "anonymous";
      
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(objectUrl);
      };

      const onLoadedMetadata = async () => {
        const { width, height } = getResizedDimensions(video.videoWidth, video.videoHeight, 512); // Back to 512
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const duration = video.duration;
        if (!duration || duration === Infinity || duration < 1) {
          cleanup();
          resolve(null);
          return;
        }

        const thumbnails: string[] = [];
        const interval = duration / (count + 1);

        for (let i = 1; i <= count; i++) {
          const time = interval * i;
          const thumbnailDataUrl = await seekAndCapture(video, time, canvas);
          if (thumbnailDataUrl) {
            thumbnails.push(thumbnailDataUrl);
          }
        }
        cleanup();
        resolve(thumbnails);
      };

      const onError = () => {
        cleanup();
        console.error(`Failed to load video metadata for timeline generation: ${file.name}`);
        resolve(null);
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);
    });
  },
};