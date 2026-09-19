import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';

const AgeGate: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem('ac_age_verified');
    if (!verified) {
      setIsVisible(true);
    }
  }, []);

  const handleVerify = () => {
    localStorage.setItem('ac_age_verified', 'true');
    setIsVisible(false);
  };

  const handleExit = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
      <div className="max-w-lg w-full mx-4 relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/20 rounded-full blur-[100px]"></div>
        
        <div className="relative z-10 bg-[#111] border border-zinc-800 rounded-3xl p-8 md:p-12 text-center shadow-2xl">
          <div className="w-20 h-20 bg-black rounded-full border-2 border-yellow-500 flex items-center justify-center mx-auto mb-8 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
            <span className="text-3xl font-bold text-yellow-400 font-poppins">18+</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Adult Content Warning
          </h1>
          
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
            This website contains <strong>sexually explicit material</strong> intended for adults only. By entering, you confirm you are at least 18 years of age (or the age of majority in your jurisdiction) and consent to view such content.
          </p>

          <div className="space-y-4">
            <button 
              onClick={handleVerify}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-bold py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center group"
            >
              <span>I am 18+ - Enter Site</span>
              <ArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button 
              onClick={handleExit}
              className="w-full bg-transparent hover:bg-zinc-800 text-zinc-500 hover:text-white py-3 rounded-xl transition-colors font-medium text-sm"
            >
              I am under 18 - Exit
            </button>
          </div>

          <p className="mt-8 text-xs text-zinc-600">
            Elysian strictly prohibits illegal content. All models appearing on this site are 18 years or older.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgeGate;