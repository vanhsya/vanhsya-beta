export interface AudioVisualizerState {
  volume: number;
}

export enum SystemStatus {
  OPTIMAL = "OPTIMAL",
  THREAT_DETECTED = "THREAT DETECTED",
  INITIALIZING = "INITIALIZING",
  TERMINATING = "TERMINATING SEQUENCE",
  DESTROYED = "SYSTEM PURGED",
  OFFLINE = "AIR-GAPPED MODE",
}

export enum SessionMode {
  PUBLIC = "PUBLIC_ECHO",
  PRIVATE = "PRIVATE_VIGIL",
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
  mode: SessionMode;
  isLocal?: boolean;
}

export interface LiveServiceConfig {
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
  onThreatCancel: () => void;
  onTranscript?: (text: string, role: "user" | "model") => void;
  onMicStatus?: (granted: boolean) => void;
}
