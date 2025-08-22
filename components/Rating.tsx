import React, { useState, useEffect } from 'react';
import { PlusIcon, MinusIcon } from './icons/ActionIcons';

interface NumericRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}

export const NumericRating: React.FC<NumericRatingProps> = ({ rating, onRatingChange, disabled = false }) => {
  const [inputValue, setInputValue] = useState(rating.toString());

  useEffect(() => {
    // Sync input value if prop changes from outside
    if (parseInt(inputValue, 10) !== rating) {
      setInputValue(rating.toString());
    }
  }, [rating]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    let newRating = parseInt(inputValue, 10);
    if (isNaN(newRating) || newRating < 0) {
      newRating = 0;
    }
    // Only call update if value has actually changed
    if (newRating !== rating) {
      onRatingChange(newRating);
    }
    // Always sanitize the display value
    setInputValue(newRating.toString()); 
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          handleBlur();
          e.currentTarget.blur();
      }
  }

  const handleIncrement = () => {
    if (!disabled) onRatingChange(rating + 1);
  };

  const handleDecrement = () => {
    if (!disabled) onRatingChange(Math.max(0, rating - 1));
  };

  return (
    <div className={`flex items-center gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <button 
        onClick={handleDecrement} 
        disabled={disabled || rating <= 0} 
        className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrement rating"
      >
        <MinusIcon className="w-4 h-4" />
      </button>
      <input 
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="w-12 h-8 text-center bg-gray-800 text-brand-text font-bold text-lg rounded-md border border-gray-700 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
        aria-label="Current rating"
      />
      <button 
        onClick={handleIncrement} 
        disabled={disabled}
        className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        aria-label="Increment rating"
      >
        <PlusIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// Renaming the export to maintain compatibility with VideoCard's import.
// The functionality is now numeric, but the component name in the file system is unchanged.
export { NumericRating as Rating };