import 'react';

// Allow non-standard properties on input elements for folder selection
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

// Represents the serializable data for a video, used for saving to the database.
export interface VideoData {
  id: string;
  relativePath: string; // e.g., "movies/sci-fi/movie.mp4". This is the unique key.
  thumbnail: string | null; // base64, can be null initially
  description: string;
  rating: number; // Numeric rating, starts at 0, no upper limit
  seen: boolean;
  tags: string[];
  fileSize: number;
  duration: number | null;
  lastModified: number;
  isPlayable: boolean;
  timesOpened: number; // New: for sorting by popularity
  dateAdded: number; // New: unix timestamp for sorting by date
  // New fields for v2
  hearted?: boolean;
  hidden?: boolean;
  deleted?: boolean; // New: for soft-deleting
  title?: string;
  contentHash?: string | null; // Reserved for more robust hashing
  currentTime?: number; // New: for saving playback position
  notFound?: boolean; // New: for files not found during scan
}

export type StatusFilter = 'watched' | 'tagged' | 'rated' | 'incompatible' | 'hearted' | 'duplicates' | 'hidden' | 'deleted' | 'renamed' | 'not-found';
export type StatusFilterState = 'include' | 'exclude';
export type StatusFilterMap = Map<StatusFilter, StatusFilterState>;


export type SortCriteria = 'filename' | 'path' | 'rating' | 'timesOpened' | 'dateAdded' | 'lastModified' | 'duration' | 'random' | 'fileSize' | 'creationTime';
export type SortDirection = 'asc' | 'desc';


export interface ScrubCache {
  get: (key: string) => string[] | undefined;
  set: (key:string, value: string[]) => void;
  delete: (key: string) => void;
  clear: () => void;
}

declare global {
  interface Window {
    // FFmpeg types for UMD script loading
    FFmpeg?: {
      FFmpeg: any;
    };
    FFmpegUtil?: {
      fetchFile: (data: any) => Promise<any>;
    };

    showDirectoryPicker?(
      options?: FileSystemDirectoryPickerOptions
    ): Promise<FileSystemDirectoryHandle>;
  }

  // Types for the File System Access API.
  // This is to provide type hints for an API that is not yet part of standard TypeScript lib files.

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
  }

  interface FileSystemGetFileOptions {
    create?: boolean;
  }

  interface FileSystemGetDirectoryOptions {
    create?: boolean;
  }

  interface FileSystemRemoveOptions {
    recursive?: boolean;
  }
  
  interface FileSystemWritableFileStream extends WritableStream {
      seek(position: number): Promise<void>;
      truncate(size: number): Promise<void>;
      write(data: BufferSource | Blob | string): Promise<void>;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  }
  
  type WellKnownDirectory =
    | 'desktop'
    | 'documents'
    | 'downloads'
    | 'music'
    | 'pictures'
    | 'videos';
    
  interface FileSystemDirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: WellKnownDirectory | FileSystemHandle;
  }
}