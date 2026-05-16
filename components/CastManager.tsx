import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { VideoContent } from '../types';

interface CastManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiveVideo: (video: VideoContent) => void;
  currentVideo: VideoContent | null;
}

export default function CastManager({ isOpen, onClose, onReceiveVideo, currentVideo }: CastManagerProps) {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remotePeerId, setRemotePeerId] = useState('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [errorDetails, setErrorDetails] = useState('');
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    if (!isOpen && !peerRef.current) return;
    if (peerRef.current) return; // Already initialized

    const id = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit id
    const peer = new Peer('vrcinema-' + id);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id.replace('vrcinema-', ''));
    });

    peer.on('connection', (conn) => {
      setStatus('CONNECTED');
      setConnection(conn);
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      setErrorDetails(err.message);
      setStatus('DISCONNECTED');
    });

    return () => {
      // Don't destroy on close so we can keep connection alive in background
    };
  }, [isOpen]);

  const setupConnection = (conn: DataConnection) => {
    conn.on('data', (data: any) => {
      if (data && data.type === 'CAST_VIDEO' && data.video) {
        onReceiveVideo(data.video);
      }
    });
    conn.on('close', () => {
      setStatus('DISCONNECTED');
      setConnection(null);
    });
  };

  const connectToPeer = () => {
    if (!peerRef.current || !remotePeerId) return;
    setStatus('CONNECTING');
    const conn = peerRef.current.connect('vrcinema-' + remotePeerId);
    conn.on('open', () => {
      setStatus('CONNECTED');
      setConnection(conn);
      setupConnection(conn);
    });
    conn.on('error', (err) => {
      setStatus('DISCONNECTED');
      setErrorDetails('連線失敗: ' + err.message);
    });
  };

  const castCurrentVideo = () => {
    if (connection && status === 'CONNECTED' && currentVideo) {
      if (currentVideo.url.startsWith('blob:')) {
        alert('無法投射本機檔案！請投射 DLNA 或網路串流連結。');
        return;
      }
      connection.send({
        type: 'CAST_VIDEO',
        video: currentVideo
      });
      alert('已送出投射指令！');
    }
  };

  if (!isOpen && status === 'DISCONNECTED') return null;

  // We keep it mounted or at least render the UI conditionally
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-vr-900 border border-gray-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/40">
          <h2 className="text-xl font-bold flex items-center">
            <svg className="w-5 h-5 mr-2 text-vr-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            設備互聯 / 投屏
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center p-4 bg-black/50 rounded-lg border border-gray-800">
            <p className="text-sm text-gray-400 mb-1">本機連線代碼</p>
            <p className="text-4xl font-mono font-bold text-white tracking-widest">{peerId || '----'}</p>
          </div>

          {status === 'DISCONNECTED' && (
             <div className="space-y-3">
               <p className="text-sm text-gray-300">輸入其他設備 (如電視或手機) 的代碼以建立連線：</p>
               <div className="flex space-x-2">
                 <input 
                   type="text" 
                   maxLength={4}
                   placeholder="4碼數字" 
                   className="flex-1 bg-black border border-gray-700 rounded p-3 text-center font-mono text-xl focus:outline-none focus:border-vr-accent"
                   value={remotePeerId}
                   onChange={(e) => setRemotePeerId(e.target.value.replace(/\D/g, ''))}
                 />
                 <button 
                   onClick={connectToPeer}
                   disabled={remotePeerId.length !== 4}
                   className="bg-vr-accent text-black font-bold px-6 rounded hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                 >
                   連線
                 </button>
               </div>
               {errorDetails && <p className="text-red-400 text-xs mt-2">{errorDetails}</p>}
             </div>
          )}

          {status === 'CONNECTING' && (
             <div className="text-center py-4 text-vr-accent animate-pulse">
               連線中...
             </div>
          )}

          {status === 'CONNECTED' && (
             <div className="space-y-4">
               <div className="bg-green-900/30 border border-green-800 text-green-400 p-3 rounded text-center">
                  已成功連線至設備！
               </div>
               <button 
                 onClick={castCurrentVideo}
                 disabled={!currentVideo}
                 className="w-full bg-vr-accent text-black font-bold py-3 rounded hover:bg-opacity-90 disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 transition-colors flex items-center justify-center"
               >
                 <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                 投射目前播放中的影片
               </button>
               {!currentVideo && (
                   <p className="text-xs text-gray-400 text-center">請先在背景選擇並播放一部影片，再來投射。</p>
               )}
               <div className="text-xs text-gray-500 mt-4 bg-black/30 p-2 rounded">
                 提示：若為本機檔案，因安全性限制無法直接投射，請改用 DLNA 網址或是外部串流連結進行投射。
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
