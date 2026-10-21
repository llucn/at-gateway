// Webhook and settings types

export interface WebhookConfig {
  smsUrl?: string;
  callUrl?: string;
  secret?: string;
  timeoutMs: number;
  maxAttempts: number;
  enabled: boolean;
}

export interface WebhookDelivery {
  id: string;
  eventType: 'sms.received' | 'call.received' | 'call.ended';
  url: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  status: 'pending' | 'delivered' | 'failed';
}

export interface SystemSettings {
  webhook: WebhookConfig;
  modem: {
    port?: string;
    baudRate: number;
    autoDetect: boolean;
    smsMode: 'PDU' | 'TEXT';
    audioMode: 'usb' | 'none';
  };
  tts: {
    provider: 'piper' | 'edge' | 'azure' | 'openai' | 'none';
    voice?: string;
    apiKey?: string;
  };
  stt: {
    provider: 'whisper-cpp' | 'faster-whisper' | 'azure' | 'openai' | 'none';
    language?: string;
    apiKey?: string;
  };
}

export interface AudioRecording {
  id: string;
  callId?: string;
  filePath: string;
  format: 'wav' | 'pcm' | 'amr';
  duration?: number; // seconds
  transcription?: string;
  createdAt: string;
}
