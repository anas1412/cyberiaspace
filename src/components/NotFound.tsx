import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#020408] text-[#e2e8f0] flex items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <div className="text-[120px] font-black text-blue-500/20 leading-none mb-4">404</div>
        <h1 className="text-3xl font-black uppercase tracking-wider mb-4">Page Not Found</h1>
        <p className="text-slate-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
          >
            <Home className="w-4 h-4" />
            Go Home
          </a>
          <button 
            onClick={() => window.history.back()} 
            className="inline-flex items-center gap-2 px-6 py-3 glass hover:bg-white/10 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
