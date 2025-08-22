
import React from 'react';
import { StopIcon } from './icons/ActionIcons';

interface ProcessingStatusBarProps {
  processedCount: number;
  totalCount: number;
  onCancel: () => void;
  taskName: string;
}

export const ProcessingStatusBar: React.FC<ProcessingStatusBarProps> = ({ processedCount, totalCount, onCancel, taskName }) => {
  const progressPercentage = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-gray-700 p-3 z-30 shadow-lg">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex-grow">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-brand-text">{taskName}</span>
            <span className="text-sm font-medium text-brand-text-secondary">{processedCount} / {totalCount}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-brand-primary h-2.5 rounded-full transition-all duration-300 ease-linear" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
        <button 
          onClick={onCancel} 
          title="Stop Processing"
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold"
        >
          <StopIcon />
          Stop
        </button>
      </div>
    </div>
  );
};