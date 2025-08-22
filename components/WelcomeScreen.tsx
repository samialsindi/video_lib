import React from 'react';
import { FolderUpIcon } from './icons/ActionIcons';

interface WelcomeScreenProps {
  onSelectClick: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectClick }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center mt-16 md:mt-32">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-4">Welcome to Your Video Library</h2>
        <p className="text-lg text-brand-text-secondary mb-8">
          To get started, select your main video folder. The app will scan for video files to build your library. You may need to re-select the folder each time you visit to enable playback.
        </p>
        <button 
          onClick={onSelectClick} 
          className="inline-flex items-center gap-3 px-8 py-4 bg-brand-primary text-white text-lg font-semibold rounded-lg hover:bg-brand-primary-hover transition-transform transform hover:scale-105"
        >
          <FolderUpIcon className="w-6 h-6"/>
          Select Video Folder
        </button>
        <p className="text-sm text-brand-text-secondary mt-8">
            Your library data is stored securely in your browser's local database and never leaves your computer.
        </p>
      </div>
    </div>
  );
};