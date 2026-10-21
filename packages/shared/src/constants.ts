// Shared constants

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SMS_MAX_LENGTH_GSM7 = 160;
export const SMS_MAX_LENGTH_UCS2 = 70;

export const PHONE_NUMBER_REGEX = /^\+?[1-9]\d{1,14}$/;

export const WEBHOOK_SIGNATURE_HEADER = 'X-Gateway-Signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Gateway-Timestamp';
export const WEBHOOK_EVENT_HEADER = 'X-Gateway-Event';

export const SIGNAL_RSSI_MIN = -113;
export const SIGNAL_RSSI_MAX = -51;

export const AUDIO_SAMPLE_RATE = 8000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_BIT_DEPTH = 16;
