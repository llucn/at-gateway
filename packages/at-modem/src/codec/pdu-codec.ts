// SMS PDU encoder/decoder
import {
  encodeGsm7,
  countGsm7Septets,
  decodeGsm7,
  encodeUcs2,
  decodeUcs2,
  isGsm7Compatible,
  encodePhoneNumber,
  decodePhoneNumber,
} from './gsm-codec.js';

export interface SmsSubmit {
  phoneNumber: string;
  text: string;
  smsc?: string;
  encoding?: 'gsm7' | 'ucs2';
}

export interface SmsDeliver {
  phoneNumber: string;
  text: string;
  timestamp: Date;
  smsc?: string;
  encoding: 'gsm7' | 'ucs2';
}

export function encodeSmsSubmitPdu(sms: SmsSubmit): { pdu: string; length: number } {
  const useGsm7 = sms.encoding === 'gsm7' || (sms.encoding === undefined && isGsm7Compatible(sms.text));
  const dcs = useGsm7 ? 0x00 : 0x08; // Data Coding Scheme: 0=GSM7, 8=UCS2

  // SMSC (Service Center Address)
  const smscPdu = sms.smsc ? encodeSmsc(sms.smsc) : '00';

  // PDU Type: SMS-SUBMIT without validity period
  // Some modems don't support VP field properly
  const pduType = 0x01; // 0000 0001 = SMS-SUBMIT without VP

  // Message Reference (let modem assign)
  const mr = 0x00;

  // Destination Address
  const da = encodeAddress(sms.phoneNumber);

  // Protocol Identifier
  const pid = 0x00;

  // Data Coding Scheme
  // const dcs already set

  // User Data
  let userData: Buffer;
  let udl: number;

  if (useGsm7) {
    userData = encodeGsm7(sms.text);
    udl = countGsm7Septets(sms.text); // septets (extended chars take two)
  } else {
    userData = encodeUcs2(sms.text);
    udl = userData.length; // octets
  }

  // Assemble PDU (without VP field)
  const pdu =
    smscPdu +
    pduType.toString(16).padStart(2, '0').toUpperCase() +
    mr.toString(16).padStart(2, '0').toUpperCase() +
    da +
    pid.toString(16).padStart(2, '0').toUpperCase() +
    dcs.toString(16).padStart(2, '0').toUpperCase() +
    udl.toString(16).padStart(2, '0').toUpperCase() +
    userData.toString('hex').toUpperCase();

  // TPDU length (everything after SMSC)
  const tpduLength = (pdu.length - smscPdu.length) / 2;

  return { pdu, length: tpduLength };
}

export function decodeSmsDeliverPdu(pdu: string): SmsDeliver {
  let offset = 0;

  // SMSC length
  const smscLen = parseInt(pdu.slice(offset, offset + 2), 16) * 2;
  offset += 2;
  const smscHex = pdu.slice(offset, offset + smscLen);
  offset += smscLen;

  const smsc = smscLen > 0 ? decodeSmsc(smscHex) : undefined;

  // PDU Type
  const pduType = parseInt(pdu.slice(offset, offset + 2), 16);
  offset += 2;

  // Originating Address
  const oaLen = parseInt(pdu.slice(offset, offset + 2), 16);
  offset += 2;
  const oaType = parseInt(pdu.slice(offset, offset + 2), 16);
  offset += 2;
  const oaDigits = Math.ceil(oaLen / 2) * 2;
  const oaHex = pdu.slice(offset, offset + oaDigits);
  offset += oaDigits;

  const phoneNumber = (oaType & 0x70) === 0x10 ? '+' + decodePhoneNumber(oaHex) : decodePhoneNumber(oaHex);

  // PID
  offset += 2;

  // DCS
  const dcs = parseInt(pdu.slice(offset, offset + 2), 16);
  offset += 2;
  const encoding = (dcs & 0x0c) === 0x08 ? 'ucs2' : 'gsm7';

  // Timestamp (7 octets, semi-octets swapped)
  const tsHex = pdu.slice(offset, offset + 14);
  offset += 14;
  const timestamp = decodeTimestamp(tsHex);

  // UDL
  const udl = parseInt(pdu.slice(offset, offset + 2), 16);
  offset += 2;

  // User Data
  const udHex = pdu.slice(offset);
  const udBuffer = Buffer.from(udHex, 'hex');

  const text = encoding === 'gsm7' ? decodeGsm7(udBuffer, udl) : decodeUcs2(udBuffer);

  return { phoneNumber, text, timestamp, smsc, encoding };
}

function encodeSmsc(number: string): string {
  const digits = number.startsWith('+') ? number.slice(1) : number;
  const encoded = encodePhoneNumber(digits);
  const len = encoded.length / 2 + 1; // +1 for type octet
  const type = number.startsWith('+') ? 0x91 : 0x81;
  return len.toString(16).padStart(2, '0').toUpperCase() + type.toString(16).padStart(2, '0').toUpperCase() + encoded.toUpperCase();
}

function decodeSmsc(hex: string): string {
  const type = parseInt(hex.slice(0, 2), 16);
  const digits = decodePhoneNumber(hex.slice(2));
  return (type & 0x70) === 0x10 ? '+' + digits : digits;
}

function encodeAddress(number: string): string {
  const digits = number.startsWith('+') ? number.slice(1) : number;
  const len = digits.length;
  const type = number.startsWith('+') ? 0x91 : 0x81;
  const encoded = encodePhoneNumber(digits);
  return len.toString(16).padStart(2, '0').toUpperCase() + type.toString(16).padStart(2, '0').toUpperCase() + encoded.toUpperCase();
}

function decodeTimestamp(hex: string): Date {
  const year = parseInt(hex.slice(1, 2) + hex.slice(0, 1), 10) + 2000;
  const month = parseInt(hex.slice(3, 4) + hex.slice(2, 3), 10) - 1;
  const day = parseInt(hex.slice(5, 6) + hex.slice(4, 5), 10);
  const hour = parseInt(hex.slice(7, 8) + hex.slice(6, 7), 10);
  const minute = parseInt(hex.slice(9, 10) + hex.slice(8, 9), 10);
  const second = parseInt(hex.slice(11, 12) + hex.slice(10, 11), 10);
  return new Date(year, month, day, hour, minute, second);
}
