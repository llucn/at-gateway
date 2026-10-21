// Modem connection and status types

export enum ModemState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export enum SimStatus {
  UNKNOWN = 'unknown',
  READY = 'ready',
  PIN_REQUIRED = 'pin_required',
  PUK_REQUIRED = 'puk_required',
  NOT_INSERTED = 'not_inserted',
  ERROR = 'error',
}

export enum NetworkStatus {
  UNKNOWN = 'unknown',
  NOT_REGISTERED = 'not_registered',
  REGISTERED_HOME = 'registered_home',
  SEARCHING = 'searching',
  DENIED = 'denied',
  REGISTERED_ROAMING = 'registered_roaming',
}

export interface SignalQuality {
  rssi: number; // dBm, typically -113 to -51
  ber: number; // bit error rate, 0-7 or 99 (unknown)
  rsrp?: number; // LTE reference signal received power
  rsrq?: number; // LTE reference signal received quality
  sinr?: number; // LTE signal-to-interference-plus-noise ratio
}

export interface ModemInfo {
  manufacturer: string;
  model: string;
  revision: string;
  imei: string;
  imsi?: string;
  iccid?: string;
}

export interface ModemStatus {
  state: ModemState;
  simStatus: SimStatus;
  networkStatus: NetworkStatus;
  operator?: string;
  operatorCode?: string; // MCC+MNC
  signalQuality: SignalQuality;
  info?: ModemInfo;
  lastUpdated: string; // ISO timestamp
}
