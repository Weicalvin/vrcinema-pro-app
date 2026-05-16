export interface VideoContent {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  url?: string; // For local or direct streams
  type: '2D' | '3D' | '360' | 'VR';
  description?: string;
  category?: string;
}

export enum PlayerMode {
  NORMAL_2D = 'NORMAL_2D',
  VR_SBS = 'VR_SBS', // Side by Side
  FULL_360 = 'FULL_360'
}

export interface KeyMapping {
  playPause: string[];
  forward: string[];
  rewind: string[];
  next: string[];
  prev: string[];
  toggleVR: string[];
  ipdIncrease: string[];
  ipdDecrease: string[];
  scaleUp: string[];
  scaleDown: string[];
}

export interface PlayerSettings {
  ipd: number; // Inter-pupillary distance adjustment (px)
  scale: number; // Screen size multiplier
  playbackRate: number;
  lensDistortion: number; // 0 to 1
  isRemoteActive: boolean;
  isGyroEnabled: boolean; // New setting for toggling gyro
}