export enum ActiveTab {
  CREATE = 'CREATE',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AD_GENERATOR = 'AD_GENERATOR',
  CHAT = 'CHAT',
  STRATEGY = 'STRATEGY',
  VOICE = 'VOICE',
  VOICE_CHAT = 'VOICE_CHAT',
  LIVE_CHAT = 'LIVE_CHAT',
  SETTINGS = 'SETTINGS',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface InfluencerProfile {
  id: string;
  name: string;
  description: string;
  image: string; // base64 encoded image
  imageMimeType: string;
}