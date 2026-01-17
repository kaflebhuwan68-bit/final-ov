
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
  language: 'ne' | 'en' | 'hi';
  newsSources: string[];
  autoPlayAudio: boolean;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  VOICE = 'voice',
  SETTINGS = 'settings'
}
