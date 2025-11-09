
import React from 'react';
import { CheckIcon, XMarkIcon } from './icons/Icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  const isSuccess = type === 'success';

  return (
    <div className="fixed bottom-6 right-6 bg-white rounded-xl card-shadow p-4 flex items-center space-x-3 slide-in z-50">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
        {isSuccess ? <CheckIcon className="w-6 h-6 text-green-500" /> : <XMarkIcon className="w-6 h-6 text-red-500" />}
      </div>
      <div>
        <p className="font-semibold text-gray-800">{message}</p>
      </div>
    </div>
  );
};

export default Toast;