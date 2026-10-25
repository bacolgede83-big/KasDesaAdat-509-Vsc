import React from 'react';
import { Droplets } from 'lucide-react';

interface SpinnerProps {
    text?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ text = "Loading..." }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <div className="relative flex items-center justify-center h-24 w-24">
        <div className="absolute h-full w-full rounded-full border-4 border-t-teal-400 border-gray-600 animate-spin"></div>
        <Droplets className="h-10 w-10 text-teal-300" />
      </div>
      <p className="mt-4 text-white text-lg font-semibold tracking-wider">{text}</p>
    </div>
  );
};

export default Spinner;