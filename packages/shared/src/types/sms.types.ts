// SMS types

export enum SmsStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  RECEIVED = 'received',
}

export enum SmsEncoding {
  GSM7 = 'gsm7',
  UCS2 = 'ucs2',
  BINARY = 'binary',
}

export interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  content: string;
  status: SmsStatus;
  encoding: SmsEncoding;
  timestamp: string; // ISO
  deliveredAt?: string; // ISO
  failureReason?: string;
  webhookDelivered?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SendSmsRequest {
  phoneNumber: string;
  content: string;
  encoding?: SmsEncoding;
}

export interface SendSmsResponse {
  id: string;
  status: SmsStatus;
  timestamp: string;
}

export interface SmsListQuery {
  page?: number;
  limit?: number;
  direction?: 'inbound' | 'outbound';
  status?: SmsStatus;
  phoneNumber?: string;
  startDate?: string;
  endDate?: string;
}
