// Barrel export for at-modem package

// Transport
export { SerialTransport, type SerialTransportOptions } from './transport/serial-transport.js';

// Core
export { AtClient, type AtClientOptions, type AtResponse } from './core/at-client.js';

// Codec
export * from './codec/gsm-codec.js';
export * from './codec/pdu-codec.js';

// Features
export { SmsManager, type SendSmsOptions } from './features/sms-manager.js';
export { CallManager, CallState, type CallInfo } from './features/call-manager.js';
export { StatusManager, type ModemStatus } from './features/status-manager.js';

// Discovery
export * from './discovery/port-discovery.js';
