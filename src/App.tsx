import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, RefreshCw, Play, Volume2, VolumeX, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Constants ---
const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const MIN_SPEED = 60;
const SPEED_STEP = 5;
const POINTS_FOR_SPEEDUP = 5;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs for game logic (to avoid re-renders during loop)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const speedRef = useRef(INITIAL_SPEED);
  const lastUpdateRef = useRef(0);
  const animationFrameRef = useRef<number>(0);

  // Initialize high score
  useEffect(() => {
    const saved = localStorage.getItem('snake-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Audio helper (placeholder logic for context - usually would use Howler)
  const playSound = useCallback((type: 'eat' | 'crash' | 'move') => {
    if (isMuted) return;
    // Basic synth sounds could be added here if needed, but for now we focus on visual feedback
  }, [isMuted]);

  // Spawn food at random empty spot
  const spawnFood = useCallback(() => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Check if food is on snake
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

  const gameOver = () => {
    setGameState('GAMEOVER');
    playSound('crash');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-highscore', score.toString());
    }
  };

  // Game Logic Tick
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
        gameOver();
        return;
      }

      // Self collision
      if (snakeRef.current.some(p => p.x === head.x && p.y === head.y)) {
        gameOver();
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
        playSound('eat');
      } else {
        newSnake.pop();
      }

      snakeRef.current = newSnake;
    }

    draw();
    animationFrameRef.current = requestAnimationFrame(update);
  }, [gameState, score, highScore, spawnFood, playSound]);

  // Drawing Logic
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Subtle Cyberpunk style)
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

    // Draw Food (Neon Red Apple)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff003c';
    ctx.fillStyle = '#ff003c';
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * cellSize + cellSize / 2,
      foodRef.current.y * cellSize + cellSize / 2,
      cellSize / 2.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Snake (Neon Green)
    snakeRef.current.forEach((part, index) => {
      const isHead = index === 0;
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.shadowColor = '#00f2ff'; // Cyber blue/green
      ctx.fillStyle = isHead ? '#00f2ff' : '#00a2ff';
      
      // Rounded snake segments
      const x = part.x * cellSize + 2;
      const y = part.y * cellSize + 2;
      const size = cellSize - 4;
      
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 4);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  };

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (['ArrowUp', 'w', 'W'].includes(key) && directionRef.current !== 'DOWN') nextDirectionRef.current = 'UP';
      if (['ArrowDown', 's', 'S'].includes(key) && directionRef.current !== 'UP') nextDirectionRef.current = 'DOWN';
      if (['ArrowLeft', 'a', 'A'].includes(key) && directionRef.current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
      if (['ArrowRight', 'd', 'D'].includes(key) && directionRef.current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      animationFrameRef.current = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [gameState, update]);

  // Touch/Mobile controls
  const handleDirChange = (dir: Direction) => {
    if (dir === 'UP' && directionRef.current !== 'DOWN') nextDirectionRef.current = 'UP';
    if (dir === 'DOWN' && directionRef.current !== 'UP') nextDirectionRef.current = 'DOWN';
    if (dir === 'LEFT' && directionRef.current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
    if (dir === 'RIGHT' && directionRef.current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-cyan-400 font-mono flex flex-col items-center justify-center p-4">
      {/* HUD */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 px-2">
        <div className="flex flex-col">
          <span className="text-xs text-cyan-700 uppercase tracking-widest">Score</span>
          <span className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            {score.toString().padStart(4, '0')}
          </span>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 border border-cyan-900/50 rounded-lg hover:bg-cyan-900/20 transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="flex flex-col items-end">
            <span className="text-xs text-cyan-700 uppercase tracking-widest flex items-center gap-1">
              <Trophy size={10} /> High Score
            </span>
            <span className="text-xl font-bold text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">
              {highScore.toString().padStart(4, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative group">
        {/* Borders */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        
        <div className="relative bg-black rounded-lg border border-cyan-500/30 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="max-w-full h-auto aspect-square cursor-none"
          />

          {/* Overlays */}
          <AnimatePresence>
            {gameState === 'START' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm"
              >
                <h1 className="text-4xl font-black mb-8 tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">
                  NEON_SNAKE.EXE
                </h1>
                <button
                  onClick={resetGame}
                  className="group relative px-8 py-3 bg-cyan-500 text-black font-bold uppercase tracking-widest rounded-sm hover:bg-cyan-400 transition-all flex items-center gap-2 overflow-hidden"
                >
                  <Play size={18} fill="black" />
                  Initialize
                  <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/20 group-hover:animate-shine" />
                </button>
                <p className="mt-6 text-xs text-cyan-700">USE ARROW KEYS OR BUTTONS TO NAVIGATE</p>
              </motion.div>
            )}

            {gameState === 'GAMEOVER' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center backdrop-blur-md border-2 border-pink-500/50"
              >
                <h2 className="text-5xl font-black text-pink-500 mb-2 italic tracking-tighter">CRITICAL_ERROR</h2>
                <p className="text-cyan-400 mb-8 font-bold tracking-widest">SYSTEM COLLISION DETECTED</p>
                <div className="mb-8 text-center">
                  <div className="text-sm text-cyan-700 uppercase">Final Score</div>
                  <div className="text-4xl text-white font-bold">{score}</div>
                </div>
                <button
                  onClick={resetGame}
                  className="flex items-center gap-2 px-8 py-3 border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black font-bold uppercase tracking-tighter transition-all"
                >
                  <RefreshCw size={20} />
                  Reboot System
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="mt-8 grid grid-cols-3 gap-2 lg:hidden">
        <div />
        <button 
          onPointerDown={() => handleDirChange('UP')}
          className="w-14 h-14 bg-cyan-900/20 border border-cyan-500/30 rounded-xl flex items-center justify-center active:bg-cyan-500 active:text-black"
        >
          <ChevronUp />
        </button>
        <div />
        <button 
          onPointerDown={() => handleDirChange('LEFT')}
          className="w-14 h-14 bg-cyan-900/20 border border-cyan-500/30 rounded-xl flex items-center justify-center active:bg-cyan-500 active:text-black"
        >
          <ChevronLeft />
        </button>
        <button 
          onPointerDown={() => handleDirChange('DOWN')}
          className="w-14 h-14 bg-cyan-900/20 border border-cyan-500/30 rounded-xl flex items-center justify-center active:bg-cyan-500 active:text-black"
        >
          <ChevronDown />
        </button>
        <button 
          onPointerDown={() => handleDirChange('RIGHT')}
          className="w-14 h-14 bg-cyan-900/20 border border-cyan-500/30 rounded-xl flex items-center justify-center active:bg-cyan-500 active:text-black"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Desktop Hints */}
      <div className="mt-8 hidden lg:block text-[10px] text-cyan-900 uppercase tracking-[0.2em]">
        [ WASD / Arrow Keys ] to steer • [ R ] to quick-restart
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          100% { left: 125%; }
        }
        .animate-shine {
          animation: shine 0.75s infinite;
        }
      `}} />
    </div>
  );
};

export default App;