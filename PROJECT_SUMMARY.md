# VR Cinema Pro - 專案詳細統整

這是一個基於 Web 的 VR 影片播放器應用程式，整合了 Telegram 登入功能，支援 2D/3D/VR 模式播放，並具備模擬頭部追蹤與遙控器按鍵對應功能。

## 1. 技術架構 (Tech Stack)

*   **核心框架**: React 19, TypeScript
*   **建置工具**: Vite 6.2
*   **樣式庫**: Tailwind CSS (透過 CDN 與配置整合)
*   **Telegram 整合**: GramJS (`telegram` npm package) - 直接在瀏覽器端與 Telegram MTProto API 通訊
*   **AI 推薦**: Google GenAI SDK (用於內容推薦邏輯)
*   **瀏覽器相容性處理**: 使用 `buffer`, `events`, `util` polyfills 以支援 GramJS 在瀏覽器運行。

## 2. 核心功能模組

### A. VR 影片播放器 (`components/VideoPlayer.tsx`)
*   **多模式支援**:
    *   **Normal 2D**: 一般平面播放。
    *   **VR Side-by-Side (SBS)**: 左右分割 3D 模式，支援 VR 眼鏡。
*   **頭部追蹤 (Head Tracking)**:
    *   利用 `DeviceOrientationEvent` (陀螺儀) 模擬 VR 頭部轉動視角。
    *   支援視角歸零 (Reset Orientation)。
*   **參數調整**:
    *   **IPD (瞳距)**: 調整左右眼影像距離。
    *   **Scale (縮放)**: 調整畫面大小與距離感。
    *   **Lens Distortion**: (預留參數) 鏡頭變形校正。
*   **同步播放**: 在 VR 模式下精確同步左右兩個 `<video>` 元素的播放進度與狀態。

### B. Telegram 整合 (`components/TelegramIntegration.tsx`, `services/telegramService.ts`)
*   **完整登入流程**:
    *   輸入 API ID / Hash (支援從 `.env` 讀取或手動輸入)。
    *   輸入電話號碼 -> 接收驗證碼 -> 輸入 2FA 密碼 (若有設定)。
    *   Session 儲存於 `localStorage`，實現自動登入。
*   **頻道內容獲取**:
    *   輸入頻道帳號 (如 `@channel`) 獲取歷史訊息。
    *   過濾並顯示包含影片 (`MessageMediaDocument` with video mime type) 的訊息。
*   **播放限制**:
    *   由於瀏覽器限制，直接串流 MTProto 加密影片流有難度。目前實作展示元數據，若為公開頻道則嘗試使用 Web Proxy 連結，或提示使用者使用外部連結。

### C. 播放列表與內容管理 (`App.tsx`)
*   **播放列表 (Playlist)**: 支援佇列管理、移除、循環播放 (上一首/下一首)。
*   **多種來源**:
    *   **本機檔案**: 支援 `<input type="file">` 讀取本地影片 Blob URL。
    *   **網路串流**: 支援輸入直接影片連結 (mp4/m3u8 等)。
    *   **Telegram**: 從整合介面加入影片。
*   **搜尋**: 整合 Gemini API 進行內容推薦 (模擬或實際查詢)。

### D. 遙控器設定 (`components/RemoteSettings.tsx`)
*   自定義鍵盤按鍵對應 (Key Mapping)，支援藍牙遙控器操作：
    *   播放/暫停、快進/快退
    *   VR 模式切換
    *   瞳距/縮放調整

## 3. 專案結構

```
/
├── .env                  # 環境變數 (Telegram API ID/Hash)
├── App.tsx               # 主應用程式邏輯、狀態管理、UI 佈局
├── index.tsx             # 進入點，包含 Polyfills 初始化
├── polyfills.ts          # Buffer 與 Global 物件補丁 (修復 GramJS 錯誤)
├── vite.config.ts        # Vite 配置 (Alias, Define, OptimizeDeps)
├── components/
│   ├── VideoPlayer.tsx         # 核心播放器組件
│   ├── TelegramIntegration.tsx # Telegram 登入與列表 UI
│   └── RemoteSettings.tsx      # 按鍵設定 UI
├── services/
│   ├── telegramService.ts      # GramJS 客戶端封裝 (Auth, Fetch)
│   └── geminiService.ts        # AI 服務封裝
└── types.ts              # TypeScript 型別定義
```

## 4. 關鍵配置細節

為了讓 Node.js 專用的 `telegram` (GramJS) 套件在瀏覽器運作，做了以下特殊配置：

1.  **Vite Config (`vite.config.ts`)**:
    *   `define`: 定義 `global: 'window'` 與 `process.env`。
    *   `resolve.alias`: 將 `buffer`, `util`, `events` 指向其瀏覽器版 polyfill (`buffer/`, `util/`, `events/`)。
    *   `optimizeDeps`: 強制預構建 `buffer` 和 `telegram`。

2.  **Polyfills (`polyfills.ts`)**:
    *   手動將 `Buffer` 注入到 `window.Buffer` 與 `window.global`，解決 `Uncaught ReferenceError: Buffer is not defined`。

## 5. 目前環境變數

*   `VITE_TELEGRAM_API_ID`: 34787888
*   `VITE_TELEGRAM_API_HASH`: d85684f2ae5328e776133b5581b77706
