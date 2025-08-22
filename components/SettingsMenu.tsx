

import React, { useState } from 'react';
import { RefreshCwIcon } from './icons/ActionIcons';

interface SettingsMenuProps {
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onExportDB: () => Promise<void>;
  onExportSelected: () => void;
  onScanDurations: () => Promise<void>;
  onFindDuplicates: () => Promise<void>;
  onFindTranscoded: () => Promise<void>;
  onResetDuplicates: () => Promise<void>;
  onUnheartAllVideos: () => Promise<void>;
  onUnhideAllVideos: () => Promise<void>;
  onResetDatabase: () => Promise<void>;
  displayedVideoCount: number;
  // Playlist props
  onExportPlaylist: () => void;
  onImportPlaylist: () => void;
  onClearPlaylist: () => void;
  playlistCount: number;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ 
    onClose, onRefresh, onExportDB, onExportSelected, onScanDurations, 
    onFindDuplicates, onFindTranscoded, onResetDuplicates, onUnheartAllVideos, onUnhideAllVideos, onResetDatabase, displayedVideoCount,
    onExportPlaylist, onImportPlaylist, onClearPlaylist, playlistCount
}) => {

  const [isActionRunning, setIsActionRunning] = useState(false);

  const handleAction = async (action: () => Promise<void> | void, confirmationMessage?: string) => {
    if (isActionRunning) return;
    
    if (confirmationMessage && !window.confirm(confirmationMessage)) {
      return; // User cancelled the action
    }

    setIsActionRunning(true);
    try {
      await Promise.resolve(action());
    } catch (error) {
      console.error("Settings menu action failed:", error);
    } finally {
      setIsActionRunning(false);
      onClose();
    }
  };
  
  const buttonClasses = "w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait";
  const enabledClasses = "hover:bg-gray-700";
  const dangerClasses = "text-red-400 hover:bg-red-900/50 hover:text-red-300";

  return (
    <div className="absolute top-full right-0 mt-2 w-72 bg-brand-surface border border-gray-700 rounded-lg shadow-xl z-30">
        <div className="p-2 border-b border-gray-700">
            <h3 className="font-bold text-white px-2">Settings & Tools</h3>
        </div>
        <div className="flex flex-col p-2 gap-1 text-sm">
            <button disabled={isActionRunning} onClick={() => handleAction(onRefresh)} className={`${buttonClasses} ${enabledClasses}`}><RefreshCwIcon className="w-4 h-4" /> Refresh Library</button>
            <hr className="border-gray-600 my-1"/>
            <button disabled={isActionRunning} onClick={() => handleAction(onScanDurations)} className={`${buttonClasses} ${enabledClasses}`}>Scan Missing Durations</button>
            <button disabled={isActionRunning} onClick={() => handleAction(onFindDuplicates)} className={`${buttonClasses} ${enabledClasses}`}>Find Duplicates (by size/duration)</button>
            <button disabled={isActionRunning} onClick={() => handleAction(onFindTranscoded)} className={`${buttonClasses} ${enabledClasses}`}>Find Transcoded Files (by path)</button>
            <button disabled={isActionRunning} onClick={() => handleAction(onResetDuplicates, "This will remove the 'Duplicate' tag from all videos. Are you sure?")} className={`${buttonClasses} ${enabledClasses}`}>Reset Duplicates</button>
            <button disabled={isActionRunning} onClick={() => handleAction(onUnheartAllVideos, "This will unheart all videos. Are you sure?")} className={`${buttonClasses} ${enabledClasses}`}>Unheart All Videos</button>
            <button disabled={isActionRunning} onClick={() => handleAction(onUnhideAllVideos, "This will unhide all videos. Are you sure?")} className={`${buttonClasses} ${enabledClasses}`}>Unhide All Videos</button>
            <hr className="border-gray-600 my-1"/>
            <button disabled={isActionRunning} onClick={() => handleAction(onExportDB)} className={`${buttonClasses} ${enabledClasses}`}>Export Library Backup</button>
            <button disabled={isActionRunning || displayedVideoCount === 0} onClick={() => handleAction(onExportSelected)} className={`${buttonClasses} ${enabledClasses}`}>Export Selection ({displayedVideoCount})</button>
            <button disabled={isActionRunning} onClick={() => handleAction(onImportPlaylist)} className={`${buttonClasses} ${enabledClasses}`}>Import Playlist</button>
            <button disabled={isActionRunning || playlistCount === 0} onClick={() => handleAction(onExportPlaylist)} className={`${buttonClasses} ${enabledClasses}`}>Export Playlist ({playlistCount})</button>
            <button disabled={isActionRunning || playlistCount === 0} onClick={() => handleAction(onClearPlaylist)} className={`${buttonClasses} ${dangerClasses}`}>Clear Playlist</button>
            <hr className="border-gray-600 my-1"/>
            <button disabled={isActionRunning} onClick={() => handleAction(onResetDatabase, "ARE YOU SURE?\n\nThis will permanently delete your entire video library database. This action cannot be undone.")} className={`${buttonClasses} ${dangerClasses}`}>Reset Database</button>
        </div>
    </div>
  );
};
