
import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Allow fade-out animation to complete before calling dismiss
        setTimeout(onDismiss, 300); 
      }, 4000); // 4 seconds
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  const baseClasses = "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 z-50 max-w-md text-center";
  const typeClasses = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  return (
    <div 
      className={`${baseClasses} ${typeClasses[type]} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      role="alert"
    >
      {message}
    </div>
  );
};
