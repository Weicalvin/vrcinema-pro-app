import React, { useState, useEffect } from 'react';
import { KeyMapping } from '../types';

interface Props {
  currentMapping: KeyMapping;
  defaultMapping: KeyMapping;
  onSave: (mapping: KeyMapping) => void;
  onClose: () => void;
}

const RemoteSettings: React.FC<Props> = ({ currentMapping, defaultMapping, onSave, onClose }) => {
  const [mapping, setMapping] = useState<KeyMapping>(currentMapping);
  const [listeningFor, setListeningFor] = useState<keyof KeyMapping | null>(null);

  useEffect(() => {
    if (!listeningFor) return;

    let clickCount = 0;
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    let longTimer: ReturnType<typeof setTimeout> | null = null;
    let isLong = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;

      const code = e.code;
      isLong = false;

      longTimer = setTimeout(() => {
        isLong = true;
        finishMapping(`${code}:long`);
      }, 600);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = e.code;

      if (longTimer) clearTimeout(longTimer);

      if (isLong) return; // Already triggered long press

      clickCount++;

      if (clickTimer) clearTimeout(clickTimer);

      clickTimer = setTimeout(() => {
        if (clickCount === 1) {
          finishMapping(code);
        } else if (clickCount >= 2) {
          finishMapping(`${code}:double`);
        }
        clickCount = 0;
      }, 300);
    };

    const finishMapping = (mappedString: string) => {
      setMapping(prev => ({
        ...prev,
        [listeningFor!]: [mappedString]
      }));
      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      if (longTimer) clearTimeout(longTimer);
      if (clickTimer) clearTimeout(clickTimer);
    };
  }, [listeningFor]);

  const actions: { key: keyof KeyMapping; label: string }[] = [
    { key: 'playPause', label: '播放 / 暫停' },
    { key: 'toggleVR', label: '切換 2D/3D 模式' },
    { key: 'ipdIncrease', label: '增加瞳距 (IPD)' },
    { key: 'ipdDecrease', label: '減少瞳距' },
    { key: 'scaleUp', label: '放大螢幕' },
    { key: 'scaleDown', label: '縮小螢幕' },
    { key: 'next', label: '下一部影片' },
    { key: 'prev', label: '上一部影片' },
    { key: 'forward', label: '快轉' },
    { key: 'rewind', label: '倒轉' },
  ];

  const formatKeyString = (keyArr: string[]) => {
    if (!keyArr || keyArr.length === 0) return '未設定';
    // Display the first mapped key combination
    const primary = keyArr[0];
    if (primary.endsWith(':double')) return `${primary.replace(':double', '')} (連按兩下)`;
    if (primary.endsWith(':long')) return `${primary.replace(':long', '')} (長按)`;
    return `${primary.replace(':single', '')} (按一下)`;
  };

  const handleClear = (key: keyof KeyMapping) => {
    setMapping(prev => ({ ...prev, [key]: [] }));
  };

  const handleDefault = (key: keyof KeyMapping) => {
    setMapping(prev => ({ ...prev, [key]: defaultMapping[key] }));
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-vr-800 border border-gray-700 rounded-lg max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-bold mb-4 text-vr-accent">遙控器按鍵設定</h2>
        <p className="text-gray-400 mb-6 text-sm">
          點擊「重新設定」，然後按下藍牙遙控器或鍵盤按鍵（支援按一下、連按兩下、長按）。<br/>
          也可針對單一功能「清空」或恢復「默認」。
        </p>

        <div className="space-y-4">
          {actions.map((action) => (
            <div key={action.key} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 p-3 rounded gap-3">
              <span className="text-gray-300 font-medium whitespace-nowrap min-w-[120px]">{action.label}</span>
              
              <div className="flex-1 text-center sm:text-left">
                {listeningFor === action.key ? (
                  <span className="text-red-400 animate-pulse text-sm">請按鍵、連按或長按...</span>
                ) : (
                  <span className="text-vr-accent font-bold font-mono text-sm">
                    {formatKeyString(mapping[action.key])}
                  </span>
                )}
              </div>

              <div className="flex space-x-2 shrink-0">
                <button
                  onClick={() => setListeningFor(listeningFor === action.key ? null : action.key)}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    listeningFor === action.key
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {listeningFor === action.key ? '取消' : '重新設定'}
                </button>
                <button
                  onClick={() => handleClear(action.key)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs transition-colors"
                  title="清空快捷鍵"
                >
                  清空
                </button>
                <button
                  onClick={() => handleDefault(action.key)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs transition-colors"
                  title="恢復預設值"
                >
                  默認
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button onClick={onClose} className="px-6 py-2 rounded text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400">
            取消
          </button>
          <button
            onClick={() => {
              onSave(mapping);
              onClose();
            }}
            className="px-6 py-2 bg-vr-accent text-black font-bold rounded hover:opacity-90"
          >
            儲存並套用
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoteSettings;