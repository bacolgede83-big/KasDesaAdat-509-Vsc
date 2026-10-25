
import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
      <Construction className="w-24 h-24 mb-6 text-teal-500" />
      <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
      <p className="text-lg">Halaman ini sedang dalam pengembangan.</p>
      <p>Fitur akan segera tersedia.</p>
    </div>
  );
};

export default PlaceholderPage;
