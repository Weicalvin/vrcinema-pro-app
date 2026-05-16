import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRecommendedContent } from './services/geminiService';
import { VideoContent, KeyMapping } from './types';
import VideoPlayer from './components/VideoPlayer';
import RemoteSettings from './components/RemoteSettings';
import TelegramIntegration from './components/TelegramIntegration';
import CastManager from './components/CastManager';

const DEFAULT_KEY_MAPPING: KeyMapping = {
  playPause: ['Enter', 'NumpadEnter', 'Space'],
  forward: ['ArrowRight', 'KeyD'],
  rewind: ['ArrowLeft', 'KeyA'],
  next: ['PageDown', 'KeyN'],
  prev: ['PageUp', 'KeyP'],
  toggleVR: ['KeyV'],
  ipdIncrease: ['ArrowUp'],
  ipdDecrease: ['ArrowDown'],
  scaleUp: ['Equal', 'NumpadAdd'],
  scaleDown: ['Minus', 'NumpadSubtract']
};

export default function App() {
  const [activeVideo, setActiveVideo] = useState<VideoContent | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>('');
  
  // Library stores search results
  const [library, setLibrary] = useState<VideoContent[]>([]);
  // Playlist stores the actual queue
  const [playlist, setPlaylist] = useState<VideoContent[]>([]);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false); // Sidebar toggle
  const [isTelegramOpen, setIsTelegramOpen] = useState(false); // Telegram modal toggle
  const [isCastManagerOpen, setIsCastManagerOpen] = useState(false); // Cast Manager toggle
  const [keyMapping, setKeyMapping] = useState<KeyMapping>(DEFAULT_KEY_MAPPING);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [flyScreenMode, setFlyScreenMode] = useState(false);

  // Load initial "Trending" content
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const results = await fetchRecommendedContent('熱門 VR 體驗');
      setLibrary(results);
      setPlaylist(results); // Init playlist with trends so next/prev works immediately
      setIsLoading(false);
    };
    init();
  }, []);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    const results = await fetchRecommendedContent(query);
    setLibrary(results);
    // Note: We do NOT overwrite playlist on search, only library
    setIsLoading(false);
  };

  const addToPlaylistAndPlay = (video: VideoContent) => {
    setPlaylist(prev => {
      // Check if already in playlist
      const exists = prev.find(v => v.id === video.id);
      if (exists) return prev;
      return [video, ...prev]; // Add to top
    });
    playVideo(video);
  };

  const removeFromPlaylist = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    setPlaylist(prev => prev.filter(v => v.id !== videoId));
    // If we removed the active video, close player or play next?
    // For now, let's keep playing but it won't be in the list for next/prev
  };

  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Filter only video files
    const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));
    
    if (videoFiles.length === 0) {
      alert("選取的資料夾中沒有影片檔案！");
      return;
    }

    const newVideos: VideoContent[] = videoFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      return {
        id: 'folder-' + Date.now() + '-' + index,
        title: file.name,
        thumbnail: '', 
        duration: '本機資料夾檔案',
        type: '2D', // Default
        url: url,
        category: '我的裝置'
      };
    });

    // Instead of adding directly to playlist, replace the home screen library
    setLibrary(newVideos);
    setSearchQuery(''); // Clear search query to show folder contents indicator
    
    // Reset input
    event.target.value = '';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newVideos: VideoContent[] = Array.from(files).map((file, index) => {
      const url = URL.createObjectURL(file);
      return {
        id: 'local-' + Date.now() + '-' + index,
        title: file.name,
        thumbnail: '', 
        duration: '本機檔案',
        type: '2D', // Default
        url: url,
        category: '我的裝置'
      };
    });

    setPlaylist(prev => [...newVideos, ...prev]);
    playVideo(newVideos[0]);
    setIsPlaylistOpen(true);
    
    // Reset input so the same files can be selected again
    event.target.value = '';
  };

  const handleAddNetworkStream = () => {
      const url = prompt("請輸入 DLNA / 影片連結 (支援 DLNA、Telegram 下載連結、直連網址):");
      if (url) {
          const title = prompt("請輸入影片標題 (選填):") || "外部 DLNA/串流影片";
          const newVideo: VideoContent = {
              id: 'stream-' + Date.now(),
              title: title,
              thumbnail: 'https://picsum.photos/400/230',
              duration: '串流',
              type: '2D',
              url: url,
              category: 'DLNA / 外部連結'
          };
          addToPlaylistAndPlay(newVideo);
          setIsPlaylistOpen(true);
      }
  };

  const playVideo = useCallback((video: VideoContent) => {
    if (video.url) {
        setActiveVideoUrl(video.url);
    } else {
        // Mock video for demo content without real URLs
        setActiveVideoUrl('https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    }
    setActiveVideo(video);
  }, []);

  const handleNext = useCallback(() => {
    if (!activeVideo || playlist.length === 0) return;
    const idx = playlist.findIndex(v => v.id === activeVideo.id);
    if (idx !== -1 && idx < playlist.length - 1) {
      playVideo(playlist[idx + 1]);
    } else {
      // Loop to start
      playVideo(playlist[0]);
    }
  }, [activeVideo, playlist, playVideo]);

  const handlePrev = useCallback(() => {
    if (!activeVideo || playlist.length === 0) return;
    const idx = playlist.findIndex(v => v.id === activeVideo.id);
    if (idx !== -1 && idx > 0) {
      playVideo(playlist[idx - 1]);
    } else if (idx === 0) {
      // Loop to end
      playVideo(playlist[playlist.length - 1]);
    }
  }, [activeVideo, playlist, playVideo]);

  return (
    <div className="min-h-screen bg-vr-900 text-white font-sans selection:bg-vr-accent selection:text-black overflow-x-hidden">
      
      {/* --- Main Navigation / Header --- */}
      <header className="sticky top-0 z-40 bg-vr-800/90 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-vr-accent rounded-full flex items-center justify-center">
              <span className="text-black font-extrabold text-xl">VR</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden md:block">Cinema<span className="text-vr-accent">Pro</span></h1>
          </div>
          
          <div className="flex-1 max-w-md mx-4">
             <div className="relative">
                <input 
                  type="text" 
                  placeholder="搜尋 VR 內容..." 
                  className="w-full bg-black/50 border border-gray-700 rounded-full py-2 px-4 text-sm focus:outline-none focus:border-vr-accent transition-colors text-white placeholder-gray-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                />
                <button onClick={() => handleSearch(searchQuery)} className="absolute right-3 top-2 text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
             </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
             {/* Fly Screen Toggle */}
             <button 
                onClick={() => setIsCastManagerOpen(true)}
                className={`p-2 rounded-full transition-colors hidden sm:block ${isCastManagerOpen ? 'bg-vr-accent text-black' : 'hover:bg-gray-700 text-gray-300'}`}
                title="設備互聯 / 投屏"
             >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </button>

             {/* Add Network Stream */}
             <button 
                onClick={handleAddNetworkStream}
                className="p-2 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
                title="加入 DLNA / 網路連結"
             >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
             </button>

             {/* Telegram Integration */}
             <button 
                onClick={() => setIsTelegramOpen(true)}
                className="p-2 hover:bg-gray-700 rounded-full text-[#0088cc] transition-colors"
                title="Telegram 頻道影片"
             >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
             </button>

             {/* Local Folder Input */}
             <label className="cursor-pointer p-2 hover:bg-gray-700 rounded-full text-gray-300 transition-colors" title="開啟本機資料夾 (顯示於首頁)">
                <input 
                  type="file" 
                  accept="video/*" 
                  // @ts-ignore
                  webkitdirectory="" 
                  directory="" 
                  multiple 
                  className="hidden" 
                  onChange={handleFolderSelect} 
                />
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
             </label>

             {/* Local File Input */}
             <label className="cursor-pointer p-2 hover:bg-gray-700 rounded-full text-gray-300 transition-colors" title="開啟本機影片">
                <input type="file" accept="video/*" multiple className="hidden" onChange={handleFileSelect} />
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
             </label>

             {/* Playlist Toggle */}
             <button 
                onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
                className={`p-2 rounded-full transition-colors relative ${isPlaylistOpen ? 'bg-vr-accent text-black' : 'hover:bg-gray-700 text-gray-300'}`}
                title="播放列表"
             >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                <span className="absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full border border-black">
                  {playlist.length}
                </span>
             </button>

             {/* Settings Toggle */}
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-700 rounded-full text-gray-300 transition-colors" title="設定">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>

             {/* Download Summary */}
             <a 
                href="/PROJECT_SUMMARY.md" 
                download="VR_Cinema_Pro_Summary.md"
                className="p-2 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
                title="下載專案說明"
             >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </a>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        
        {/* Featured / Results Section */}
        <section className={`transition-all duration-300 ${isPlaylistOpen ? 'mr-0 md:mr-80' : ''}`}>
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-2xl font-bold border-l-4 border-vr-accent pl-4">
                {isLoading ? '搜尋中...' : (library[0]?.id.startsWith('folder-') ? '資料夾內容' : '探索內容')}
             </h2>
             <div className="text-sm text-gray-400 hidden sm:block">
                點擊卡片加入播放列表
             </div>
          </div>

          {isLoading ? (
             <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vr-accent"></div>
             </div>
          ) : library.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {library.map((video) => (
                <div 
                  key={video.id} 
                  className="group bg-vr-800 rounded-xl overflow-hidden shadow-lg hover:shadow-vr-accent/20 transition-all duration-300 hover:-translate-y-1 cursor-pointer ring-1 ring-gray-800 hover:ring-vr-accent"
                  onClick={() => addToPlaylistAndPlay(video)}
                >
                  <div className="relative aspect-video bg-gray-900 overflow-hidden flex items-center justify-center">
                    {video.thumbnail ? (
                       <img 
                         src={video.thumbnail} 
                         alt={video.title} 
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                       />
                    ) : (
                       <svg className="w-16 h-16 text-gray-700 group-hover:scale-110 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                       <div className="w-12 h-12 rounded-full bg-vr-accent/90 flex items-center justify-center">
                          <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                       </div>
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/80 text-xs px-2 py-1 rounded text-white font-mono">
                      {video.duration}
                    </span>
                    <span className="absolute top-2 left-2 bg-vr-accent text-black text-xs font-bold px-2 py-0.5 rounded uppercase">
                      {video.type}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-1 truncate group-hover:text-vr-accent transition-colors">{video.title}</h3>
                    <div className="flex justify-between items-center text-sm text-gray-400">
                       <span>{video.category || '一般'}</span>
                       {playlist.find(p => p.id === video.id) && (
                           <span className="text-vr-accent text-xs border border-vr-accent px-1 rounded">已加入</span>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center py-20 bg-vr-800/50 rounded-xl border border-dashed border-gray-700">
                <p className="text-gray-400 text-lg">找不到相關內容</p>
                <button onClick={() => handleSearch('VR Nature')} className="mt-4 text-vr-accent hover:underline">
                   嘗試搜尋 "VR 大自然"
                </button>
             </div>
          )}
        </section>

        {/* --- Playlist Sidebar --- */}
        <aside 
          className={`fixed top-[65px] bottom-0 right-0 w-80 bg-vr-900/95 backdrop-blur-xl border-l border-gray-800 transform transition-transform duration-300 z-30 shadow-2xl flex flex-col ${isPlaylistOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/20">
            <h3 className="font-bold text-lg flex items-center">
                <svg className="w-5 h-5 mr-2 text-vr-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                播放列表
            </h3>
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">{playlist.length} 部影片</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {playlist.length === 0 ? (
                <div className="text-center text-gray-500 py-10 px-4">
                    <p>列表是空的</p>
                    <p className="text-sm mt-2">點擊影片或新增連結來建立您的播放清單</p>
                </div>
            ) : (
                playlist.map((video, idx) => (
                    <div 
                        key={`${video.id}-${idx}`} 
                        onClick={() => playVideo(video)}
                        className={`flex items-start p-2 rounded-lg cursor-pointer transition-colors group ${activeVideo?.id === video.id ? 'bg-vr-accent/20 border border-vr-accent/50' : 'hover:bg-gray-800 border border-transparent'}`}
                    >
                        <div className="relative w-20 h-12 bg-gray-900 rounded overflow-hidden flex-shrink-0 mr-3">
                             {video.thumbnail ? (
                                <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                </div>
                             )}
                             {activeVideo?.id === video.id && (
                                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                     <div className="w-2 h-2 bg-vr-accent rounded-full animate-ping"></div>
                                 </div>
                             )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium truncate ${activeVideo?.id === video.id ? 'text-vr-accent' : 'text-gray-200'}`}>
                                {video.title}
                            </h4>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-gray-500">{video.duration}</span>
                                <span className="text-[10px] uppercase bg-gray-700 text-gray-300 px-1 rounded">{video.type}</span>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => removeFromPlaylist(e, video.id)}
                            className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                            title="從列表移除"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))
            )}
          </div>
          
          <div className="p-3 border-t border-gray-800 bg-black/40">
              <button 
                onClick={() => setPlaylist([])}
                className="w-full py-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-colors"
                disabled={playlist.length === 0}
              >
                  清空列表
              </button>
          </div>
        </aside>
      </main>

      {/* --- Overlays --- */}
      {activeVideo && (
        <VideoPlayer
          videoId={activeVideo.id}
          src={activeVideoUrl}
          videoTitle={activeVideo.title}
          // Simple logic to guess default mode based on type
          initialMode={activeVideo.type === '3D' || activeVideo.type === 'VR' ? 'VR_SBS' : 'NORMAL_2D'} 
          keyMapping={keyMapping}
          onClose={() => setActiveVideo(null)}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}

      {isSettingsOpen && (
        <RemoteSettings
          currentMapping={keyMapping}
          defaultMapping={DEFAULT_KEY_MAPPING}
          onSave={setKeyMapping}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <TelegramIntegration 
        isOpen={isTelegramOpen} 
        onClose={() => setIsTelegramOpen(false)} 
        onAddVideo={(video) => {
          addToPlaylistAndPlay(video);
          setIsPlaylistOpen(true);
        }} 
      />

      <CastManager
        isOpen={isCastManagerOpen}
        onClose={() => setIsCastManagerOpen(false)}
        currentVideo={activeVideo}
        onReceiveVideo={(video) => {
          addToPlaylistAndPlay(video);
          setIsPlaylistOpen(true);
        }}
      />
    </div>
  );
}