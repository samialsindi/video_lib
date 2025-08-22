import React from 'react';
import { FolderUpIcon } from './icons/ActionIcons';

interface SelectFolderScreenProps {
  onSelectClick: () => void;
  videoCount: number;
}

export const SelectFolderScreen: React.FC<SelectFolderScreenProps> = ({ onSelectClick, videoCount }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center mt-16 md:mt-32">
      <div className="max-w-2xl mx-auto bg-brand-surface p-8 rounded-lg shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-3">Library Loaded</h2>
        <p className="text-lg text-brand-text-secondary mb-6">
          Your library contains <span className="font-bold text-brand-primary">{videoCount}</span> videos. To continue, please select the corresponding video folder to grant access for this session.
        </p>
        <button 
          onClick={onSelectClick} 
          className="inline-flex items-center gap-3 px-8 py-4 bg-brand-primary text-white text-lg font-semibold rounded-lg hover:bg-brand-primary-hover transition-transform transform hover:scale-105"
        >
          <FolderUpIcon className="w-6 h-6"/>
          Select Video Folder
        </button>
      </div>
    </div>
  );
};
