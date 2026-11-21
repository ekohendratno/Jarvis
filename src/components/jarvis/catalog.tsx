import { Brain, Folder, Globe, MessageSquare, AudioLines, Monitor, Clock, Slack } from 'lucide-react'
import { SiGmail, SiGooglecalendar, SiGoogledrive, SiGoogledocs, SiGooglesheets, SiNotion, SiGithub, SiYoutube, SiInstagram, SiFacebook, SiX, SiDiscord, SiSpotify } from 'react-icons/si'

export const APPS = [
  { id: 'gmail', name: 'Gmail', color: '#ea5a51', x: 60, y: 15, icon: SiGmail },
  { id: 'calendar', name: 'Google Calendar', color: '#6e9fff', x: 76, y: 27, icon: SiGooglecalendar },
  { id: 'drive', name: 'Google Drive', color: '#efc75e', x: 87, y: 44, icon: SiGoogledrive },
  { id: 'docs', name: 'Google Docs', color: '#75a7fb', x: 88, y: 64, icon: SiGoogledocs },
  { id: 'sheets', name: 'Google Sheets', color: '#64bb95', x: 77, y: 83, icon: SiGooglesheets },
  { id: 'notion', name: 'Notion', color: '#e3e4df', x: 59, y: 92, icon: SiNotion },
  { id: 'youtube', name: 'YouTube', color: '#e56565', x: 40, y: 92, icon: SiYoutube },
  { id: 'instagram', name: 'Instagram', color: '#d88bbb', x: 23, y: 83, icon: SiInstagram },
  { id: 'github', name: 'GitHub', color: '#d9dad6', x: 14, y: 64, icon: SiGithub },
  { id: 'web', name: 'Web', color: '#a4c7a6', x: 25, y: 48, icon: Globe },
  { id: 'x', name: 'Twitter', color: '#dadbd7', x: 14, y: 43, icon: SiX },
  { id: 'facebook', name: 'Facebook', color: '#799de3', x: 23, y: 27, icon: SiFacebook },
  { id: 'slack', name: 'Slack', color: '#cb8cb9', x: 40, y: 15, icon: Slack },
  { id: 'voice', name: 'Voice', color: '#c9d3c6', x: 49, y: 30, icon: AudioLines },
  { id: 'chat', name: 'Chat', color: '#c4d2bf', x: 68, y: 48, icon: MessageSquare },
  { id: 'files', name: 'Files', color: '#c2c8be', x: 33, y: 72, icon: Folder },
  { id: 'memory', name: 'Memory', color: '#c2c8be', x: 60, y: 73, icon: Brain },
]
export const EXTRA_APPS = [
  { id: 'desktop', name: 'Windows', color: '#8daaf2', icon: Monitor },
  { id: 'discord', name: 'Discord', color: '#8996f1', icon: SiDiscord },
  { id: 'spotify', name: 'Spotify', color: '#7ecb90', icon: SiSpotify },
  { id: 'custom', name: 'Custom MCP', color: '#bca6dc', icon: Globe },
  { id: 'time', name: 'Clock', color: '#d3b37d', icon: Clock },
]
