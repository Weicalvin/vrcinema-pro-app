import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlayerMode, PlayerSettings, KeyMapping } from '../types';
import { useVideoFilter, filterPresets } from '../hooks/useVideoFilter';

interface Props {
  videoId: string;
  src: string;
  initialMode?: PlayerMode;
  keyMapping: KeyMapping;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  videoTitle?: string;
}

const VideoPlayer: React.FC<Props> = ({
  videoId,
  src,
  initialMode = PlayerMode.NORMAL_2D,
  keyMapping,
  onClose,
  onNext,
  onPrev,
  videoTitle
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefRight = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<PlayerMode>(initialMode);
  const [settings, setSettings] = useState<PlayerSettings>({
    ipd: 0,
    scale: 1.0,
    playbackRate: 1.0,
    lensDistortion: 0,
    isRemoteActive: true,
    isGyroEnabled: true
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Gesture States
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [osdText, setOsdText] = useState<string | null>(null);

  const [currentFilter, setCurrentFilter] = useState('標準');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const visualFilters = Object.keys(filterPresets);

  const hudTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTimeRef = useRef<number>(0);

  // Gyroscope Refs
  const orientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const initialOrientationRef = useRef<{ alpha: number, beta: number, gamma: number } | null>(null);
  const isGyroAvailable = useRef(false);

  // Gesture Tracking Refs
  const pointerStart = useRef<{ x: number, y: number, time: number } | null>(null);
  const pointerType = useRef<'none' | 'seek' | 'volume' | 'brightness'>('none');
  const initialSeekTime = useRef<number>(0);
  const initialVolume = useRef<number>(1);
  const initialBrightness = useRef<number>(1);
  const hasSwiped = useRef<boolean>(false);

  const showOSD = useCallback((text: string) => {
    setOsdText(text);
    if (osdTimeout.current) clearTimeout(osdTimeout.current);
    osdTimeout.current = setTimeout(() => setOsdText(null), 1500);
  }, []);

  const handleFilterChange = (f: string) => {
    setCurrentFilter(f);
    setShowFilterMenu(false);
    showOSD(`切換濾鏡: ${f}`);
  };

  // Sync controls for Right Eye
  const syncPlayers = useCallback(() => {
    if (mode === PlayerMode.VR_SBS && videoRef.current && videoRefRight.current) {
      if (Math.abs(videoRef.current.currentTime - videoRefRight.current.currentTime) > 0.1) {
         videoRefRight.current.currentTime = videoRef.current.currentTime;
      }
      if (videoRef.current.paused !== videoRefRight.current.paused) {
        if (videoRef.current.paused) videoRefRight.current.pause();
        else videoRefRight.current.play();
      }
    }
  }, [mode]);

  // HUD Visibility timer
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimeout.current) clearTimeout(hudTimeout.current);
    hudTimeout.current = setTimeout(() => setShowHud(false), 3000);
  }, []);

  useEffect(() => {
    const interval = setInterval(syncPlayers, 500);
    return () => clearInterval(interval);
  }, [syncPlayers]);

  // Gyroscope / Head Tracking Logic
  useEffect(() => {
    // If not in VR mode, just apply scale
    if (mode !== PlayerMode.VR_SBS) {
        if (containerRef.current) containerRef.current.style.transform = `scale(${settings.scale})`;
        return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
        if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
            isGyroAvailable.current = true;
            if (!initialOrientationRef.current) {
                initialOrientationRef.current = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
            }
            orientationRef.current = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
        }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    let animationFrameId: number;
    const updateView = () => {
        // Only apply transformation if Gyro is available AND Enabled in settings
        if (containerRef.current && isGyroAvailable.current && initialOrientationRef.current && settings.isGyroEnabled) {
            const { gamma, beta } = orientationRef.current;
            const { gamma: iGamma, beta: iBeta } = initialOrientationRef.current;
            
            let dGamma = gamma - iGamma;
            let dBeta = beta - iBeta;

            if (dGamma > 180) dGamma -= 360;
            if (dGamma < -180) dGamma += 360;

            const sensitivity = 2.0; 
            const transX = -dGamma * sensitivity; 
            const transY = -dBeta * sensitivity;

            const clampedX = Math.max(-60, Math.min(60, transX));
            const clampedY = Math.max(-40, Math.min(40, transY));

            containerRef.current.style.transform = `translate3d(${clampedX}%, ${clampedY}%, 0) scale(${settings.scale})`;
        } else if (containerRef.current) {
             // Reset position but keep scale if gyro is disabled
             containerRef.current.style.transform = `translate3d(0, 0, 0) scale(${settings.scale})`;
        }
        animationFrameId = requestAnimationFrame(updateView);
    };
    updateView();

    return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
        cancelAnimationFrame(animationFrameId);
        // Do not clear initialOrientationRef here to allow seamless toggle back
    };
  }, [mode, settings.scale, settings.isGyroEnabled]);


  // Key Event Handler
  useEffect(() => {
    const doubleClickWindow = 300; // ms
    const longPressWindow = 600; // ms

    const activeTimers: Record<string, ReturnType<typeof setTimeout>> = {};
    const clickCounts: Record<string, number> = {};
    const interactionState: Record<string, { isLong: boolean }> = {};

    // Helper to see if a specific key has double or long mappings anywhere
    const keyAssignedTypes = (code: string) => {
        const types = { double: false, long: false };
        Object.values(keyMapping).forEach((keys) => {
            keys.forEach((k) => {
                if (k === `${code}:double`) types.double = true;
                if (k === `${code}:long`) types.long = true;
            });
        });
        return types;
    };

    const triggerAction = (inputStr: string) => {
      resetHudTimer();
      const normalizedInput = inputStr.replace(':single', '');

      if (keyMapping.playPause.includes(normalizedInput)) {
        togglePlay();
      } else if (keyMapping.forward.includes(normalizedInput)) {
        seek(10);
      } else if (keyMapping.rewind.includes(normalizedInput)) {
        seek(-10);
      } else if (keyMapping.toggleVR.includes(normalizedInput)) {
        setMode(prev => prev === PlayerMode.NORMAL_2D ? PlayerMode.VR_SBS : PlayerMode.NORMAL_2D);
      } else if (keyMapping.ipdIncrease.includes(normalizedInput)) {
        adjustSetting('ipd', 2);
      } else if (keyMapping.ipdDecrease.includes(normalizedInput)) {
        adjustSetting('ipd', -2);
      } else if (keyMapping.scaleUp.includes(normalizedInput)) {
        adjustSetting('scale', 0.05);
      } else if (keyMapping.scaleDown.includes(normalizedInput)) {
        adjustSetting('scale', -0.05);
      } else if (keyMapping.next.includes(normalizedInput)) {
        onNext();
      } else if (keyMapping.prev.includes(normalizedInput)) {
        onPrev();
      } else if (normalizedInput === 'Escape') {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (e.repeat) return;

      if (code === 'Escape') {
          onClose();
          return;
      }
      if (code === 'KeyR') {
          initialOrientationRef.current = null;
          return;
      }

      const assigned = keyAssignedTypes(code);
      interactionState[code] = { isLong: false };

      if (assigned.long) {
          activeTimers[`long_${code}`] = setTimeout(() => {
              interactionState[code].isLong = true;
              triggerAction(`${code}:long`);
          }, longPressWindow);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      
      if (activeTimers[`long_${code}`]) {
          clearTimeout(activeTimers[`long_${code}`]);
          delete activeTimers[`long_${code}`];
      }

      if (interactionState[code] && interactionState[code].isLong) {
          return; // Already handled as long press
      }

      const assigned = keyAssignedTypes(code);

      if (assigned.double) {
          clickCounts[code] = (clickCounts[code] || 0) + 1;
          
          if (activeTimers[`click_${code}`]) {
              clearTimeout(activeTimers[`click_${code}`]);
          }

          activeTimers[`click_${code}`] = setTimeout(() => {
              const count = clickCounts[code];
              clickCounts[code] = 0;
              
              if (count === 1) {
                  triggerAction(code); // single
              } else if (count >= 2) {
                  triggerAction(`${code}:double`);
              }
          }, doubleClickWindow);
      } else {
          // No double click mapped for this key, safe to trigger single immediately
          triggerAction(code);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        Object.values(activeTimers).forEach(clearTimeout);
    };
  }, [keyMapping, onNext, onPrev, onClose, resetHudTimer]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary pointer (usually touch or left click)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    // Ignore clicks on controls (HUD)
    const target = e.target as HTMLElement;
    if (target.closest('.hud-controls')) return;

    if (e.target instanceof HTMLElement) {
       e.target.setPointerCapture(e.pointerId);
    }

    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    pointerType.current = 'none';
    hasSwiped.current = false;
    
    if (videoRef.current) {
        initialSeekTime.current = videoRef.current.currentTime;
    }
    initialVolume.current = volume;
    initialBrightness.current = brightness;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;

    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;

    if (pointerType.current === 'none') {
        if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
            hasSwiped.current = true;
            if (Math.abs(dx) > Math.abs(dy)) {
                pointerType.current = 'seek';
            } else {
                const { innerWidth } = window;
                pointerType.current = pointerStart.current.x > innerWidth / 2 ? 'volume' : 'brightness';
            }
        }
    }

    if (pointerType.current === 'seek') {
        const { innerWidth } = window;
        let d = videoRef.current ? videoRef.current.duration : 1;
        if (isNaN(d)) d = 1;

        // Scrub up to 3 mins for a full screen swipe
        const timeDelta = (dx / innerWidth) * Math.min(d, 180);
        let newTime = Math.max(0, Math.min(d, initialSeekTime.current + timeDelta));
        
        if (videoRef.current) videoRef.current.currentTime = newTime;
        if (videoRefRight.current) videoRefRight.current.currentTime = newTime;
        
        showOSD(`跳轉至 ${formatTime(newTime)}`);
    } else if (pointerType.current === 'volume') {
        const deltaV = -(dy / window.innerHeight) * 1.5;
        const newVol = Math.max(0, Math.min(1, initialVolume.current + deltaV));
        setVolume(newVol);
        if (videoRef.current) videoRef.current.volume = newVol;
        if (videoRefRight.current) videoRefRight.current.volume = newVol;
        showOSD(`音量: ${Math.round(newVol * 100)}%`);
    } else if (pointerType.current === 'brightness') {
        const deltaB = -(dy / window.innerHeight) * 2;
        const newB = Math.max(0.1, Math.min(3, initialBrightness.current + deltaB));
        setBrightness(newB);
        showOSD(`亮度: ${Math.round(newB * 100)}%`);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) {
       e.target.releasePointerCapture(e.pointerId);
    }
    
    // If it was a quick tap without swipe, toggle play
    if (pointerStart.current && !hasSwiped.current && Date.now() - pointerStart.current.time < 300) {
        // Exclude UI clicks
        const target = e.target as HTMLElement;
        if (!target.closest('.hud-controls')) {
             togglePlay();
        }
    }

    pointerStart.current = null;
    pointerType.current = 'none';
    
    // reset hasSwiped after a short delay so onClick handlers don't accidentally fire
    setTimeout(() => {
        hasSwiped.current = false;
    }, 100);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        videoRefRight.current?.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRefRight.current?.pause();
        setIsPlaying(false);
      }
    }
  };

  const seek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
      if(videoRefRight.current) videoRefRight.current.currentTime = videoRef.current.currentTime;
    }
  };

  const adjustSetting = (key: keyof PlayerSettings, delta: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'number' ? (prev[key] as number) + delta : prev[key]
    }));
  };

  const toggleGyro = () => {
     setSettings(prev => ({ ...prev, isGyroEnabled: !prev.isGyroEnabled }));
     // Reset orientation reference when re-enabling so view doesn't snap wildly
     if (!settings.isGyroEnabled) {
         initialOrientationRef.current = null;
     }
  };

  const handleEnded = () => {
      // Clear progress when video naturally ends
      try {
          localStorage.removeItem(`vr-cinema-progress-${videoId}`);
      } catch (e) {}
      currentTimeRef.current = 0;
      onNext();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      currentTimeRef.current = time;
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      try {
        const savedTime = localStorage.getItem(`vr-cinema-progress-${videoId}`);
        if (savedTime) {
            const time = parseFloat(savedTime);
            if (!isNaN(time) && time > 0) {
                videoRef.current.currentTime = time;
                currentTimeRef.current = time;
                setCurrentTime(time);
                if (videoRefRight.current) {
                    videoRefRight.current.currentTime = time;
                }
            }
        }
      } catch (e) {}
    }
  };

  // Save progress when videoId changes or unmounts
  useEffect(() => {
     return () => {
         if (currentTimeRef.current > 0) {
             try {
                 localStorage.setItem(`vr-cinema-progress-${videoId}`, currentTimeRef.current.toString());
             } catch (e) {}
         }
     };
  }, [videoId]);

  const handleSeekbarChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    if (videoRefRight.current) {
      videoRefRight.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const styleFilter = useVideoFilter(brightness, currentFilter);

  const commonVideoClass = "w-full h-full object-contain bg-black";
  const videoStyle = { filter: styleFilter };

  return (
    <div
      className="fixed inset-0 bg-black z-50 overflow-hidden flex flex-col touch-none"
      onMouseMove={resetHudTimer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* SVG Filters for Enhancing Video Quality */}
      <svg width="0" height="0" className="absolute top-0 left-0 pointer-events-none">
        <defs>
          <filter id="low-light-enhance">
            {/* Gamma Correction: exponent < 1 brightens shadows. amplitude protects highlights */}
            <feComponentTransfer>
              <feFuncR type="gamma" amplitude="1.1" exponent="0.5" offset="0" />
              <feFuncG type="gamma" amplitude="1.1" exponent="0.5" offset="0" />
              <feFuncB type="gamma" amplitude="1.1" exponent="0.5" offset="0" />
            </feComponentTransfer>
            {/* Saturation compensation to prevent it from looking washed out */}
            <feColorMatrix type="saturate" values="1.6" />
          </filter>
        </defs>
      </svg>

      {/* OSD Overlay */}
      {osdText && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none bg-black/60 text-white font-mono text-2xl font-bold px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm">
             {osdText}
          </div>
      )}

      {/* HUD Overlay */}
      <div
        className={`hud-controls absolute top-0 left-0 w-full p-4 z-20 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex justify-between items-center max-w-7xl mx-auto text-white">
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-2xl hover:text-vr-accent">&larr;</button>
          <h1 className="text-lg font-bold truncate mx-4">{videoTitle || '正在播放'}</h1>
          <div className="flex items-center space-x-4 text-sm font-mono">
            <span className="bg-gray-800 text-white px-2 py-1 rounded font-bold text-xs border border-gray-700 hidden sm:inline-block">
                {currentFilter}
            </span>
            {mode === PlayerMode.VR_SBS && (
              <>
                 <span className={`text-xs hidden sm:inline mr-2 ${isGyroAvailable.current ? 'text-green-400' : 'text-gray-500'}`}>
                    {isGyroAvailable.current ? (settings.isGyroEnabled ? '陀螺儀: 開' : '陀螺儀: 關') : '無陀螺儀'}
                 </span>
                 <span className="text-vr-accent">瞳距: {settings.ipd}px | 縮放: {Math.round(settings.scale * 100)}%</span>
              </>
            )}
            <span className="bg-vr-accent text-black px-2 py-1 rounded font-bold text-xs">
                {mode === PlayerMode.NORMAL_2D ? '2D 模式' : (mode === PlayerMode.VR_SBS ? 'VR 模式' : '360 模式')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Player Area */}
      <div className="flex-1 relative flex items-center justify-center w-full h-full overflow-hidden">
        {/* Container for Head Tracking Transform */}
        <div ref={containerRef} className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out will-change-transform">
            {mode === PlayerMode.NORMAL_2D ? (
            <video
                ref={videoRef}
                src={src}
                className={commonVideoClass}
                style={videoStyle}
                controls={false}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />
            ) : (
            // VR Side-by-Side Mode
            <div className="flex w-full h-full items-center">
                {/* Left Eye */}
                <div className="w-1/2 h-full flex items-center justify-center overflow-hidden border-r border-gray-900 relative bg-black">
                    <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.9)_110%)]"></div>
                    <div style={{ marginRight: `${settings.ipd}px` }} className="w-full h-full flex items-center justify-center">
                        <video
                            ref={videoRef}
                            src={src}
                            className={commonVideoClass}
                            style={videoStyle}
                            playsInline
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={handleEnded}
                        />
                    </div>
                </div>

                {/* Right Eye */}
                <div className="w-1/2 h-full flex items-center justify-center overflow-hidden relative bg-black">
                    <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.9)_110%)]"></div>
                    <div style={{ marginLeft: `${settings.ipd}px` }} className="w-full h-full flex items-center justify-center">
                        <video
                            ref={videoRefRight}
                            src={src}
                            className={commonVideoClass}
                            style={videoStyle}
                            playsInline
                            muted
                        />
                    </div>
                </div>
            </div>
            )}
        </div>
        
        {/* Split Line Overlay (Stationary) */}
        {mode === PlayerMode.VR_SBS && (
             <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2 pointer-events-none z-30"></div>
        )}
      </div>

      {/* Control Bar (Bottom) */}
      <div
        className={`hud-controls absolute bottom-0 left-0 w-full p-6 z-20 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div onClick={(e) => e.stopPropagation()} className="max-w-4xl mx-auto flex flex-col gap-4">
            {/* Progress Bar */}
            <div className="flex items-center space-x-3 text-sm font-mono text-gray-300">
                <span>{formatTime(currentTime)}</span>
                <div 
                    className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden cursor-pointer group"
                    onClick={handleSeekbarChange}
                >
                    <div 
                        className="h-full bg-vr-accent group-hover:bg-[#00e0ff] transition-colors relative"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    ></div>
                </div>
                <span>{formatTime(duration)}</span>
            </div>

            <div className="flex justify-between items-center text-white">
                <div className="flex items-center space-x-4 sm:space-x-6">
                    <button onClick={togglePlay} className="hover:text-vr-accent">
                        {isPlaying ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                    </button>
                    
                    <button onClick={() => setMode(mode === PlayerMode.NORMAL_2D ? PlayerMode.VR_SBS : PlayerMode.NORMAL_2D)} className="flex items-center space-x-2 bg-gray-800 px-3 py-1 rounded hover:bg-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447 1.054L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span className="hidden sm:inline">{mode === PlayerMode.NORMAL_2D ? '2D 模式' : 'VR 模式'}</span>
                    </button>

                    <div className="relative">
                        <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="flex items-center space-x-1 bg-gray-800 px-3 py-1 rounded hover:bg-gray-700 font-bold text-xs">
                            <span className="sm:inline">{currentFilter}</span>
                            <svg className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {showFilterMenu && (
                            <div className="absolute bottom-full mb-2 left-0 sm:left-1/2 sm:-translate-x-1/2 w-28 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden py-1 z-50">
                                {visualFilters.map(f => (
                                    <button 
                                        key={f} 
                                        onClick={(e) => { e.stopPropagation(); handleFilterChange(f); }} 
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors ${currentFilter === f ? 'text-vr-accent font-bold bg-black/40' : 'text-white'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {mode === PlayerMode.VR_SBS && (
                        <>
                           <button onClick={toggleGyro} className={`p-2 rounded hover:bg-gray-700 ${settings.isGyroEnabled ? 'text-green-400' : 'text-gray-500'}`} title={settings.isGyroEnabled ? "關閉陀螺儀" : "開啟陀螺儀"}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
                           </button>
                           <button onClick={() => { initialOrientationRef.current = null; }} className="text-xs bg-gray-800 px-2 py-1 rounded hover:bg-gray-700" title="視角歸零 (按鍵: R)">
                               視角歸零
                           </button>
                        </>
                    )}
                </div>

                {/* VR Controls */}
                {mode === PlayerMode.VR_SBS && (
                    <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-bold text-gray-400">
                        <div className="flex flex-col items-center">
                            <span className="mb-1">瞳距</span>
                            <div className="flex">
                                <button onClick={() => adjustSetting('ipd', -2)} className="px-2 py-1 bg-gray-800 rounded-l hover:bg-gray-700 border-r border-gray-700">-</button>
                                <button onClick={() => adjustSetting('ipd', 2)} className="px-2 py-1 bg-gray-800 rounded-r hover:bg-gray-700">+</button>
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="mb-1">縮放</span>
                            <div className="flex">
                                <button onClick={() => adjustSetting('scale', -0.05)} className="px-2 py-1 bg-gray-800 rounded-l hover:bg-gray-700 border-r border-gray-700">-</button>
                                <button onClick={() => adjustSetting('scale', 0.05)} className="px-2 py-1 bg-gray-800 rounded-r hover:bg-gray-700">+</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;