import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons/ActionIcons';

interface HeaderPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const HeaderPagination: React.FC<HeaderPaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const goToPage = () => {
    let page = parseInt(pageInput, 10);
    const safeTotalPages = totalPages > 0 ? totalPages : 1;
    if (isNaN(page) || page < 1) {
      page = 1;
    } else if (page > safeTotalPages) {
      page = safeTotalPages;
    }
    onPageChange(page);
    // Also reset the input field to the corrected page number
    setPageInput(String(page));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      goToPage();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        title="Previous Page"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>
      
      <span className="text-brand-text-secondary">Page</span>
      <input
        type="text"
        value={pageInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={goToPage}
        className="w-12 h-8 text-center bg-gray-800 text-brand-text font-bold rounded-md border border-gray-700 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
        aria-label={`Current Page, ${currentPage} of ${totalPages > 0 ? totalPages : 1}`}
      />
      <span className="text-brand-text-secondary">of {totalPages > 0 ? totalPages : 1}</span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        title="Next Page"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
