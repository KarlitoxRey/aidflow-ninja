
import React, { useState } from 'react';
import CharacterSelect from './components/CharacterSelect';
import GameCanvas from './components/GameCanvas';
import { NinjaType } from './types';
import { getBattleTaunt } from './services/geminiService';

const App: React.FC = () => {
  const [selectedNinja, setSelectedNinja] = useState<NinjaType | null>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [winner, setWinner] = useState<string | null>(null);
  const [taunt, setTaunt] = useState<string>('');
  const [isLoadingTaunt, setIsLoadingTaunt] = useState(false);

  const handleNinjaSelect = (type: NinjaType) => {
    setSelectedNinja(type);
    setGameState('playing');
  };

  const handleGameOver = async (winnerName: string) => {
    setWinner(winnerName);
    setGameState('gameover');
    setIsLoadingTaunt(true);
    
    // Randomly pick an opponent name for the taunt
    const loserName = "The Fallen Shinobi";
    const battleTaunt = await getBattleTaunt(winnerName, loserName);
    setTaunt(battleTaunt);
    setIsLoadingTaunt(false);
  };

  const resetGame = () => {
    setGameState('menu');
    setSelectedNinja(null);
    setWinner(null);
    setTaunt('');
  };

  if (gameState === 'menu') {
    return <CharacterSelect onSelect={handleNinjaSelect} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      {gameState === 'playing' && selectedNinja && (
        <div className="w-full flex flex-col items-center">
          <button 
            onClick={resetGame}
            className="mb-4 text-gray-500 hover:text-white transition-colors flex items-center gap-2 text-sm uppercase tracking-widest"
          >
            <i className="fas fa-arrow-left"></i> Back to Dojo
          </button>
          <GameCanvas 
            playerType={selectedNinja} 
            enemyType={NinjaType.CRIMSON === selectedNinja ? NinjaType.SHADOW : NinjaType.CRIMSON}
            onGameOver={handleGameOver}
          />
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="max-w-xl w-full text-center p-12 bg-gray-900 border-4 border-red-900 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.2)] animate-in fade-in zoom-in duration-500">
          <i className="fas fa-award text-7xl text-yellow-500 mb-6 drop-shadow-glow"></i>
          <h2 className="text-5xl font-ninja text-white mb-2">VICTORY</h2>
          <p className="text-2xl text-red-500 font-bold mb-8">{winner} is the Ultimate Ninja</p>
          
          <div className="bg-black/50 p-6 rounded-xl border border-gray-800 mb-8 italic text-gray-300 relative">
            <i className="fas fa-quote-left absolute -top-3 -left-2 text-red-600 text-xl"></i>
            {isLoadingTaunt ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            ) : (
              taunt
            )}
          </div>

          <button
            onClick={resetGame}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-ninja text-xl rounded-xl transition-all shadow-lg hover:shadow-red-900/40"
          >
            CONTINUE YOUR JOURNEY
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
