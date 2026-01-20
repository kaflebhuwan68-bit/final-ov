
export interface BriefingData {
  greeting: string;
  weather: string;
  nepse: string;
  news: string[];
  quote: string;
  timestamp: string;
}

export interface UserSettings {
  name: string;
  language: 'ne' | 'en' | 'hi' | 'bho' | 'new';
  newsSources: string[];
  autoPlayAudio: boolean;
  theme: 'day' | 'night' | 'system';
  autoListen: boolean;
  autoStartBriefing: boolean;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  VOICE = 'voice',
  SETTINGS = 'settings'
}
