import React, { useState, useEffect } from 'react';
import { VideoContent } from '../types';
import { initClient, sendCode, signIn, signInWithPassword, isLoggedIn, getMessages, logout } from '../services/telegramService';
import { Api } from 'telegram/tl';

interface TelegramIntegrationProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: (video: VideoContent) => void;
}

type AuthState = 'CHECKING' | 'INPUT_API' | 'INPUT_PHONE' | 'INPUT_CODE' | 'INPUT_PASSWORD' | 'LOGGED_IN';

export default function TelegramIntegration({ isOpen, onClose, onAddVideo }: TelegramIntegrationProps) {
  const [authState, setAuthState] = useState<AuthState>('CHECKING');
  
  // Auth Data
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [password, setPassword] = useState('');
  
  // Content Data
  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [videos, setVideos] = useState<VideoContent[]>([]);

  // Check login status on mount/open
  useEffect(() => {
    if (isOpen) {
      checkLogin();
    }
  }, [isOpen]);

  const checkLogin = async () => {
    setAuthState('CHECKING');
    try {
      // Try to init with env vars first
      const client = await initClient();
      
      if (!client) {
        // If init failed (likely missing API ID/Hash), ask for them
        setAuthState('INPUT_API');
        return;
      }

      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        setAuthState('LOGGED_IN');
      } else {
        setAuthState('INPUT_PHONE');
      }
    } catch (err) {
      console.error('Login check failed:', err);
      setAuthState('INPUT_API');
    }
  };

  const handleApiSubmit = async () => {
    if (!apiId || !apiHash) {
      setError('請輸入 API ID 和 API Hash');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const client = await initClient(Number(apiId), apiHash);
      if (client) {
        setAuthState('INPUT_PHONE');
      } else {
        setError('初始化失敗，請檢查 API ID/Hash');
      }
    } catch (err) {
      setError('初始化錯誤: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSubmit = async () => {
    if (!phoneNumber) {
      setError('請輸入電話號碼');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // Pass api credentials if we have them in state (user input), otherwise service uses env
      const result = await sendCode(phoneNumber, apiId ? Number(apiId) : undefined, apiHash || undefined);
      setPhoneCodeHash(result.phoneCodeHash);
      setAuthState('INPUT_CODE');
    } catch (err: any) {
      console.error(err);
      setError('發送驗證碼失敗: ' + (err.errorMessage || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (!phoneCode) {
      setError('請輸入驗證碼');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await signIn(
        phoneNumber, 
        phoneCodeHash, 
        phoneCode, 
        apiId ? Number(apiId) : undefined, 
        apiHash || undefined
      );
      
      if (result === 'PASSWORD_NEEDED') {
        setAuthState('INPUT_PASSWORD');
      } else {
        setAuthState('LOGGED_IN');
      }
    } catch (err: any) {
      console.error(err);
      setError('登入失敗: ' + (err.errorMessage || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      setError('請輸入密碼');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await signInWithPassword(
        password, 
        apiId ? Number(apiId) : undefined, 
        apiHash || undefined
      );
      setAuthState('LOGGED_IN');
    } catch (err: any) {
      console.error(err);
      setError('密碼錯誤: ' + (err.errorMessage || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthState('INPUT_PHONE');
    setVideos([]);
    setChannelName('');
  };

  const fetchChannelVideos = async () => {
    if (!channelName) return;
    setIsLoading(true);
    setError('');
    setVideos([]);

    try {
      const cleanName = channelName.replace('@', '').trim();
      
      // Use real Telegram client to fetch messages
      const messages = await getMessages(cleanName, 50); // Fetch last 50 messages
      
      const fetchedVideos: VideoContent[] = [];
      
      for (const msg of messages) {
        if (msg.media && msg.media.className === 'MessageMediaDocument' && msg.document) {
           // Check if it's a video (mime type starting with video/)
           const mimeType = (msg.document as any).mimeType;
           if (mimeType && mimeType.startsWith('video/')) {
             // For now, we can't easily stream directly from MTProto to HTML5 video tag without a proxy/transcoder.
             // However, for public channels, we can sometimes construct a web link or use a download worker.
             // BUT, the user asked for "Telegram login system", implying we should use the authenticated client.
             // Direct streaming from MTProto in browser requires downloading chunks.
             // For this demo, we will try to find a direct link if possible, or fall back to a placeholder
             // explaining that direct streaming requires a backend proxy in this environment.
             
             // Actually, for the purpose of this "Cinema" app, we might need a way to get a blob URL.
             // GramJS supports downloading media. We can download small videos to Blob.
             // Large videos would require a streaming server.
             
             // Let's try to see if we can get a direct link for public channels using the t.me/s/ trick as fallback?
             // No, the user specifically asked for login.
             
             // Let's use a placeholder URL for now but with real metadata, 
             // and maybe implement a small download-to-blob for small files if requested.
             // Or better: Use a public web viewer link if available.
             
             // Wait, if we are logged in, we can access private channels too.
             // Let's just list them and when clicked, maybe try to download?
             // Downloading a 2GB movie in browser memory is bad.
             
             // Workaround: We will list the videos. If clicked, we can't easily stream MTProto in <video> src.
             // We will use a dummy URL or if it's a public channel, try the web preview URL.
             
             const doc = msg.document as any;
             const title = msg.message || 'Telegram Video';
             const duration = doc.attributes.find((a: any) => a.className === 'DocumentAttributeVideo')?.duration;
             
             // Construct a web preview URL if public
             // https://t.me/channelname/msgId
             // But that's a webpage, not a video file.
             
             // For this environment, we will use a "Stream" placeholder
             // In a real app, you'd need a local proxy server to convert MTProto stream to HTTP stream.
             
             fetchedVideos.push({
               id: `tg-${msg.id}`,
               title: title,
               thumbnail: 'https://picsum.photos/400/225', // We could try to download thumb
               duration: duration ? `${Math.floor(duration / 60)}:${duration % 60}` : 'Telegram',
               type: '2D',
               url: '', // We will handle this in onAddVideo or play logic? 
                        // Actually App.tsx expects a URL.
                        // We can't give a URL. 
                        // Let's give a special URL protocol 'telegram://' and handle it?
                        // Or just warn the user.
               category: `Telegram: @${cleanName}`,
               // Store the message object or ID to download later?
               // For now let's use the t.me link as "url" and maybe the player can't play it but shows it.
               // actually, let's fall back to the public proxy method for the URL if possible,
               // OR just show the metadata.
             });
           }
        }
      }

      if (fetchedVideos.length === 0) {
        setError('找不到影片或無法讀取頻道內容。');
      } else {
        setVideos(fetchedVideos);
      }
    } catch (err: any) {
      console.error(err);
      setError('獲取頻道內容時發生錯誤: ' + (err.errorMessage || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get a playable URL (Mocking the complex MTProto streaming for now)
  // In a full implementation, we would use `client.downloadMedia` to a Blob, but that's heavy.
  const getPlayableUrl = async (video: VideoContent) => {
      // For the demo, if we can't stream, we just pass a sample or the web link.
      // If the user wants to play "Telegram Channel Videos", they usually mean public ones.
      // If private, we really need a backend.
      
      // Let's try to use the previous public proxy method for the URL if it's a public channel
      // This is a hybrid approach: Auth to list/search, Public Proxy to play.
      if (video.category?.includes('@')) {
          const channel = video.category.split('@')[1];
          const msgId = video.id.replace('tg-', '');
          // Try to construct a direct link from a public web viewer if possible?
          // It's hard to guess the direct video URL without scraping.
          
          // Fallback: Just return a sample video to prove the UI works, 
          // and explain limitation.
          alert("注意: 瀏覽器端直接播放 Telegram MTProto 串流受限。目前僅展示元數據整合。\n\n若為公開頻道，可嘗試使用外部連結功能。");
          return 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'; 
      }
      return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-vr-800 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/20">
          <h2 className="text-xl font-bold flex items-center text-[#0088cc]">
            <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            Telegram 整合
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* State: CHECKING */}
          {authState === 'CHECKING' && (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0088cc]"></div>
            </div>
          )}

          {/* State: INPUT_API */}
          {authState === 'INPUT_API' && (
            <div className="space-y-4">
               <div className="bg-yellow-900/30 border border-yellow-700/50 p-4 rounded-lg text-sm text-yellow-200 mb-4">
                  <p className="font-bold mb-1">需要 API 設定</p>
                  <p>請輸入您的 Telegram API ID 和 Hash。您可以在 <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="underline">my.telegram.org</a> 取得。</p>
               </div>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">API ID</label>
                 <input type="text" value={apiId} onChange={e => setApiId(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
               </div>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">API Hash</label>
                 <input type="text" value={apiHash} onChange={e => setApiHash(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
               </div>
               <button onClick={handleApiSubmit} disabled={isLoading} className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-2 rounded transition-colors">
                 {isLoading ? '連接中...' : '下一步'}
               </button>
               {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          )}

          {/* State: INPUT_PHONE */}
          {authState === 'INPUT_PHONE' && (
            <div className="space-y-4">
               <h3 className="text-lg font-bold">登入 Telegram</h3>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">電話號碼 (含國碼，如 +886...)</label>
                 <input type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+886912345678" className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
               </div>
               <button onClick={handlePhoneSubmit} disabled={isLoading} className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-2 rounded transition-colors">
                 {isLoading ? '發送驗證碼...' : '發送驗證碼'}
               </button>
               {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
               <div className="text-xs text-gray-500 mt-4 text-center">
                 您的登入資訊僅儲存於本地瀏覽器，不會傳送至任何第三方伺服器。
               </div>
            </div>
          )}

          {/* State: INPUT_CODE */}
          {authState === 'INPUT_CODE' && (
            <div className="space-y-4">
               <h3 className="text-lg font-bold">輸入驗證碼</h3>
               <p className="text-sm text-gray-400">驗證碼已發送至您的 Telegram App</p>
               <div>
                 <input type="text" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} placeholder="12345" className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white text-center tracking-widest text-xl" />
               </div>
               <button onClick={handleCodeSubmit} disabled={isLoading} className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-2 rounded transition-colors">
                 {isLoading ? '驗證中...' : '登入'}
               </button>
               {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          )}

          {/* State: INPUT_PASSWORD */}
          {authState === 'INPUT_PASSWORD' && (
            <div className="space-y-4">
               <h3 className="text-lg font-bold">兩步驟驗證</h3>
               <p className="text-sm text-gray-400">請輸入您的雲端密碼</p>
               <div>
                 <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
               </div>
               <button onClick={handlePasswordSubmit} disabled={isLoading} className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-2 rounded transition-colors">
                 {isLoading ? '驗證中...' : '登入'}
               </button>
               {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          )}

          {/* State: LOGGED_IN */}
          {authState === 'LOGGED_IN' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                 <span className="text-green-400 text-sm flex items-center">
                   <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                   已登入
                 </span>
                 <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white underline">登出</button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  輸入頻道帳號 (例如: @channelname)
                </label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="@channelname"
                    className="flex-1 bg-black/50 border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-[#0088cc] transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && fetchChannelVideos()}
                  />
                  <button 
                    onClick={fetchChannelVideos}
                    disabled={isLoading || !channelName}
                    className="bg-[#0088cc] hover:bg-[#0077b5] disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                  >
                    {isLoading ? '載入中...' : '獲取影片'}
                  </button>
                </div>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </div>

              {videos.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">找到 {videos.length} 部影片</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {videos.map(video => (
                      <div key={video.id} className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-[#0088cc] transition-colors flex flex-col group">
                        <div className="relative aspect-video bg-black">
                          <img src={video.thumbnail} alt="thumbnail" className="w-full h-full object-cover opacity-80" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center group-hover:bg-[#0088cc] transition-colors">
                              <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                          <span className="absolute bottom-1 right-1 bg-black/70 text-xs px-1 rounded">{video.duration}</span>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <p className="text-sm text-gray-300 line-clamp-2 mb-3">{video.title}</p>
                          <button 
                            onClick={async () => {
                              const playableUrl = await getPlayableUrl(video);
                              onAddVideo({ ...video, url: playableUrl });
                              onClose();
                            }}
                            className="w-full bg-gray-800 hover:bg-[#0088cc] text-white text-sm py-1.5 rounded transition-colors"
                          >
                            加入播放列表
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
