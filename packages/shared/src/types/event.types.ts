// Event types for WebSocket and internal event bus

export enum EventType {
  // Modem events
  MODEM_CONNECTED = 'modem.connected',
  MODEM_DISCONNECTED = 'modem.disconnected',
  MODEM_ERROR = 'modem.error',
  MODEM_STATUS_UPDATE = 'modem.status_update',

  // SMS events
  SMS_RECEIVED = 'sms.received',
  SMS_SENT = 'sms.sent',
  SMS_FAILED = 'sms.failed',

  // Call events
  CALL_INCOMING = 'call.incoming',
  CALL_STARTED = 'call.started',
  CALL_ANSWERED = 'call.answered',
  CALL_ENDED = 'call.ended',
  CALL_FAILED = 'call.failed',

  // System events
  SYSTEM_ERROR = 'system.error',
  WEBHOOK_DELIVERY_FAILED = 'webhook.delivery_failed',
}

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ModemEvent extends BaseEvent {
  type: EventType.MODEM_CONNECTED | EventType.MODEM_DISCONNECTED | EventType.MODEM_ERROR | EventType.MODEM_STATUS_UPDATE;
}

export interface SmsEvent extends BaseEvent {
  type: EventType.SMS_RECEIVED | EventType.SMS_SENT | EventType.SMS_FAILED;
  data: {
    id: string;
    phoneNumber: string;
    content?: string;
    error?: string;
  };
}

export interface CallEvent extends BaseEvent {
  type: EventType.CALL_INCOMING | EventType.CALL_STARTED | EventType.CALL_ANSWERED | EventType.CALL_ENDED | EventType.CALL_FAILED;
  data: {
    id: string;
    phoneNumber: string;
    error?: string;
  };
}

export type SystemEvent = ModemEvent | SmsEvent | CallEvent | BaseEvent;
