import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, RefreshCw, Play, Volume2, VolumeX, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';

// --- Constants ---
const GRID_SIZE = 20;
const INITIAL_SPEED = 160;
const MIN_SPEED = 60;
const SPEED_STEP = 5;
const POINTS_FOR_SPEEDUP = 5;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

// Sound Effects (Using standard paths or data URIs for demo robustness)
// In a real app, these would be local assets
const sounds = {
  eat: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'], volume: 0.4 }),
  crash: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'], volume: 0.5 }),
  move: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'], volume: 0.1 }),
};

const App: React.FC = () => {
  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [canvasSize, setCanvasSize] = useState(400);
  
  // --- Refs for Game Logic ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const speedRef = useRef(INITIAL_SPEED);
  const lastUpdateRef = useRef(0);
  const animationFrameRef = useRef<number>(0);
  const touchStartRef = useRef<Point | null>(null);

  // --- Responsive Handling ---
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // Calculate size based on container or window, with min/max bounds
        const width = containerRef.current.clientWidth;
        const size = Math.min(width, 500); // Cap at 500px for desktop
        setCanvasSize(size);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('snake-neon-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
    
    const muted = localStorage.getItem('snake-neon-muted');
    if (muted) setIsMuted(muted === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('snake-neon-muted', isMuted.toString());
    Object.values(sounds).forEach(s => s.mute(isMuted));
  }, [isMuted]);

  // --- Game Mechanics ---
  const spawnFood = useCallback(() => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const onSnake = snakeRef.current.some(p => p.x === newFood.x && p.y === newFood.y);
      if (!onSnake) break;
    }
    foodRef.current = newFood;
  }, []);

  const resetGame = () => {
    snakeRef.current = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 }
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    speedRef.current = INITIAL_SPEED;
    setScore(0);
    spawnFood();
    setGameState('PLAYING');
  };

  const handleGameOver = () => {
    setGameState('GAMEOVER');
    sounds.crash.play();
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-neon-highscore', score.toString());
    }
  };

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    if (time - lastUpdateRef.current > speedRef.current) {
      lastUpdateRef.current = time;
      
      directionRef.current = nextDirectionRef.current;
      const head = { ...snakeRef.current[0] };

      switch (directionRef.current) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        handleGameOver();
        return;
      }

      // Self collision
      if (snakeRef.current.some(p => p.x === head.x && p.y === head.y)) {
        handleGameOver();
        return;
      }

      const newSnake = [head, ...snakeRef.current];

      // Food collision
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore(s => {
          const newScore = s + 1;
          if (newScore % POINTS_FOR_SPEEDUP === 0) {
            speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_STEP);
          }
          return newScore;
        });
        spawnFood();
        sounds.eat.play();
      } else {
        newSnake.pop();
      }

      snakeRef.current = newSnake;
    }

    draw();
    animationFrameRef.current = requestAnimationFrame(update);
  }, [gameState, score, highScore, spawnFood]);

  // --- Rendering ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Grid
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Food (Neon Glow)
    const fx = foodRef.current.x * cellSize + cellSize / 2;
    const fy = foodRef.current.y * cellSize + cellSize / 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff003c';
    ctx.fillStyle = '#ff003c';
    ctx.beginPath();
    ctx.arc(fx, fy, cellSize / 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake
    snakeRef.current.forEach((part, index) => {
      const isHead = index === 0;
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.shadowColor = isHead ? '#00f2ff' : '#00a2ff';
      ctx.fillStyle = isHead ? '#00f2ff' : '#0066ff';
      
      const padding = cellSize * 0.1;
      const x = part.x * cellSize + padding;
      const y = part.y * cellSize + padding;
      const size = cellSize - padding * 2;
      
      ctx.beginPath();
      // Round rect for snake body segments
      const radius = isHead ? 6 : 4;
      ctx.roundRect(x, y, size, size, radius);
      ctx.fill();

      // Eyes for head
      if (isHead) {
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 0;
        const eyeSize = cellSize * 0.15;
        if (directionRef.current === 'RIGHT' || directionRef.current === 'LEFT') {
          ctx.fillRect(x + size * 0.6, y + size * 0.2, eyeSize, eyeSize);
          ctx.fillRect(x + size * 0.6, y + size * 0.6, eyeSize, eyeSize);
        } else {
          ctx.fillRect(x + size * 0.2, y + size * 0.2, eyeSize, eyeSize);
          ctx.fillRect(x + size * 0.6, y + size * 0.2, eyeSize, eyeSize);
        }
      }
    });
    ctx.shadowBlur = 0;
  }, []);

  // --- Input Handling ---
  const changeDirection = useCallback((dir: Direction) => {
    if (dir === 'UP' && directionRef.current !== 'DOWN') nextDirectionRef.current = 'UP';
    if (dir === 'DOWN' && directionRef.current !== 'UP') nextDirectionRef.current = 'DOWN';
    if (dir === 'LEFT' && directionRef.current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
    if (dir === 'RIGHT' && directionRef.current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (['ArrowUp', 'w', 'W'].includes(key)) changeDirection('UP');
      if (['ArrowDown', 's', 'S'].includes(key)) changeDirection('DOWN');
      if (['ArrowLeft', 'a', 'A'].includes(key)) changeDirection('LEFT');
      if (['ArrowRight', 'd', 'D'].includes(key)) changeDirection('RIGHT');
      if (key.toLowerCase() === 'r') resetGame();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  // --- Swipe Detection ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStartRef.current.x;
    const dy = touchEnd.y - touchStartRef.current.y;
    
    // Minimum swipe distance
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      animationFrameRef.current = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [gameState, update]);

  return (
    <div className="min-h-screen bg-[#070707] text-cyan-400 font-mono flex flex-col items-center justify-center p-2 sm:p-4 selection:bg-cyan-500 selection:text-black">
      {/* Dynamic Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[500px] flex justify-between items-center mb-4 sm:mb-6"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] text-cyan-700 uppercase tracking-[0.2em] font-black">
            <Zap size={12} className="text-cyan-500 animate-pulse" /> Current Session
          </div>
          <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
            {score.toString().padStart(3, '0')}
          </span>
        </div>
        
        <div className="flex gap-2 sm:gap-4 items-center">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-full hover:bg-white/5 transition-colors"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-pink-700 uppercase tracking-[0.2em] flex items-center gap-1 font-black">
              <Trophy size={10} /> Record
            </span>
            <span className="text-2xl font-black text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
              {highScore.toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Game Area Container */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-[500px] aspect-square"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Neon Glow Frame */}
        <div className="absolute -inset-[2px] bg-gradient-to-tr from-cyan-500 via-blue-600 to-pink-500 rounded-xl blur-[1px] opacity-40"></div>
        
        <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-white/10 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            className="block w-full h-full"
          />

          {/* Overlay UI */}
          <AnimatePresence>
            {gameState === 'START' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <h1 className="text-4xl sm:text-6xl font-black mb-2 tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600 leading-none">
                    NEON_SNAKE
                  </h1>
                </motion.div>
                <p className="text-cyan-800 text-[10px] mb-10 tracking-[0.3em] font-bold uppercase">Enhanced Response Unit v2.0</p>
                
                <button
                  onClick={resetGame}
                  className="group relative px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-sm hover:bg-cyan-400 transition-all flex items-center gap-3"
                >
                  <Play size={20} fill="black" />
                  Initialize_System
                </button>
                
                <div className="mt-8 flex flex-col gap-2 text-cyan-600 text-[9px] uppercase tracking-widest opacity-60">
                  <p>Swipe or Use Arrows to Control</p>
                  <p className="hidden sm:block">Press 'R' to Emergency Reboot</p>
                </div>
              </motion.div>
            )}

            {gameState === 'GAMEOVER' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center backdrop-blur-xl"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-pink-500/50 animate-pulse"></div>
                <h2 className="text-4xl sm:text-6xl font-black text-pink-500 mb-2 italic tracking-tighter">DATA_CORRUPTION</h2>
                <p className="text-cyan-500 mb-10 font-black tracking-[0.2em] text-xs">CRITICAL SYSTEM COLLISION</p>
                
                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="text-center border-r border-white/10 pr-8">
                    <div className="text-[10px] text-cyan-800 uppercase font-black">Final Yield</div>
                    <div className="text-4xl text-white font-black">{score}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-pink-900 uppercase font-black">Max Cache</div>
                    <div className="text-4xl text-pink-500 font-black">{highScore}</div>
                  </div>
                </div>

                <button
                  onClick={resetGame}
                  className="flex items-center gap-3 px-10 py-4 border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-black font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                >
                  <RefreshCw size={20} />
                  Cold_Reboot
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Responsive Visual Controls (D-PAD) - Improved Touch Interaction */}
      <div className="mt-8 grid grid-cols-3 gap-3 touch-none">
        <div />
        <DpadButton icon={<ChevronUp />} onClick={() => changeDirection('UP')} />
        <div />
        <DpadButton icon={<ChevronLeft />} onClick={() => changeDirection('LEFT')} />
        <DpadButton icon={<ChevronDown />} onClick={() => changeDirection('DOWN')} />
        <DpadButton icon={<ChevronRight />} onClick={() => changeDirection('RIGHT')} />
      </div>

      {/* Bottom Status Bar */}
      <div className="mt-auto pt-8 w-full max-w-[500px] flex justify-between items-center text-[9px] text-cyan-900 uppercase font-bold tracking-[0.2em]">
        <span>Status: {gameState === 'PLAYING' ? 'Link_Active' : 'Standby'}</span>
        <span className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${gameState === 'PLAYING' ? 'bg-cyan-500 animate-pulse' : 'bg-red-500'}`}></div>
          Grid_Sync: 100%
        </span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          100% { left: 125%; }
        }
        .animate-shine {
          animation: shine 0.75s infinite;
        }
        canvas {
          image-rendering: pixelated;
        }
      `}} />
    </div>
  );
};

const DpadButton: React.FC<{ icon: React.ReactNode; onClick: () => void }> = ({ icon, onClick }) => (
  <button 
    onPointerDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    className="w-14 h-14 sm:w-16 sm:h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-cyan-500 active:bg-cyan-500 active:text-black active:scale-95 transition-all shadow-lg active:shadow-cyan-500/40"
  >
    {icon}
  </button>
);

export default App;