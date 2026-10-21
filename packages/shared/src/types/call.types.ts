// Voice call types

export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum CallStatus {
  INITIATING = 'initiating',
  RINGING = 'ringing',
  ACTIVE = 'active',
  ENDED = 'ended',
  FAILED = 'failed',
  MISSED = 'missed',
}

export interface CallRecord {
  id: string;
  direction: CallDirection;
  phoneNumber: string;
  status: CallStatus;
  startedAt: string; // ISO
  answeredAt?: string; // ISO
  endedAt?: string; // ISO
  duration?: number; // seconds
  failureReason?: string;
  recordingId?: string;
  transcription?: string;
  webhookDelivered?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MakeCallRequest {
  phoneNumber: string;
  ttsMessage?: string;
  ttsVoice?: string;
}

export interface MakeCallResponse {
  id: string;
  status: CallStatus;
  timestamp: string;
}

export interface CallListQuery {
  page?: number;
  limit?: number;
  direction?: CallDirection;
  status?: CallStatus;
  phoneNumber?: string;
  startDate?: string;
  endDate?: string;
}
