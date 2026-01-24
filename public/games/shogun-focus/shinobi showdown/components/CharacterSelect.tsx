
import React from 'react';
import { NinjaType } from '../types';
import { NINJA_CONFIGS } from '../constants';

interface CharacterSelectProps {
  onSelect: (type: NinjaType) => void;
}

const CharacterSelect: React.FC<CharacterSelectProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0a0a0a]">
      <h1 className="text-6xl font-ninja text-red-600 mb-2 drop-shadow-[0_2px_2px_rgba(255,255,255,0.5)]">
        SHINOBI SHOWDOWN
      </h1>
      <p className="text-gray-400 mb-12 text-lg">Choose your ninja and enter the arena</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
        {(Object.keys(NINJA_CONFIGS) as NinjaType[]).map((type) => {
          const config = NINJA_CONFIGS[type];
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="group relative bg-gray-900 border-2 border-gray-800 rounded-xl overflow-hidden hover:border-red-600 transition-all transform hover:-translate-y-2 focus:outline-none"
            >
              {/* Character Silhouette/Icon Placeholder */}
              <div 
                className="h-48 w-full flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: config.color }}
              >
                <i className="fas fa-user-ninja text-7xl text-white/20 group-hover:scale-110 transition-transform"></i>
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
              </div>
              
              <div className="p-6 text-left">
                <h3 className="text-2xl font-ninja text-white mb-2 group-hover:text-red-500">{config.name}</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">{config.description}</p>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-gray-500">
                  <div>
                    Speed: <div className="h-1 bg-gray-700 mt-1"><div className="h-full bg-blue-500" style={{width: `${config.speed * 80}%`}}></div></div>
                  </div>
                  <div>
                    Power: <div className="h-1 bg-gray-700 mt-1"><div className="h-full bg-red-500" style={{width: `${config.strength * 60}%`}}></div></div>
                  </div>
                  <div>
                    Jump: <div className="h-1 bg-gray-700 mt-1"><div className="h-full bg-green-500" style={{width: `${config.jumpForce * 6}%`}}></div></div>
                  </div>
                  <div>
                    Range: <div className="h-1 bg-gray-700 mt-1"><div className="h-full bg-yellow-500" style={{width: `${config.range}%`}}></div></div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="mt-12 text-gray-600 animate-pulse text-sm">
        <i className="fas fa-keyboard mr-2"></i>
        Controls: WASD + SPACE BAR
      </div>
    </div>
  );
};

export default CharacterSelect;
