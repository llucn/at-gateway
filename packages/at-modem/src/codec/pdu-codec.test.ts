import { describe, expect, it } from 'vitest';
import { decodeSmsDeliverPdu, encodeSmsSubmitPdu } from './pdu-codec.js';

// Hand-verified vectors (3GPP TS 23.040 / 23.038).
// "hello" in GSM 7-bit packed septets = E8329BFD06
// +441234567890 as semi-octet swapped digits = 44 21 43 65 87 09
const HELLO_UD = 'E8329BFD06';

/** Build an SMS-DELIVER PDU with a timestamp of 2025-10-12 11:22:33 (semi-octets swapped). */
function deliverPdu(opts: { smsc?: string; oa: string; ud: string; udl: string; dcs?: string }): string {
  return (
    (opts.smsc ?? '00') +
    '04' + // SMS-DELIVER
    opts.oa +
    '00' + // PID
    (opts.dcs ?? '00') +
    '52012111223300' + // timestamp 25-10-12 11:22:33, tz 00
    opts.udl +
    opts.ud
  );
}

describe('encodeSmsSubmitPdu', () => {
  it('encodes a short English sentence as GSM 7-bit', () => {
    const { pdu, length } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'hello' });

    expect(pdu).toBe('00' + '01' + '00' + '0C91442143658709' + '00' + '00' + '05' + HELLO_UD);
    expect(length).toBe(18);
  });

  it('encodes an English sentence with SMSC into the expected PDU string', () => {
    const { pdu, length } = encodeSmsSubmitPdu({
      phoneNumber: '+85291234567',
      text: 'It is easy to send text messages.',
      smsc: '+85290000000',
    });

    expect(pdu).toBe(
      '07915892000000F0' + // SMSC: length 7, international, 85290000000
        '01' + // SMS-SUBMIT
        '00' + // message reference
        '0B915892214365F7' + // DA: 11 digits, international, 85291234567
        '00' + // PID
        '00' + // DCS: GSM 7-bit
        '21' + // UDL: 33 septets
        '493A283D0795C3F33C88FE06CDCB6E32885EC6D341EDF27C1E3E97E72E',
    );
    expect(length).toBe((pdu.length - 16) / 2);
  });

  it('encodes Chinese text as UCS-2 big-endian', () => {
    const { pdu, length } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: '你好' });

    // DCS 08, UDL 04 (octets), UD 4F60 597D
    expect(pdu).toBe('00' + '01' + '00' + '0C91442143658709' + '00' + '08' + '04' + '4F60597D');
    expect(length).toBe(17);
  });

  it('encodes a Chinese sentence with SMSC', () => {
    const { pdu } = encodeSmsSubmitPdu({
      phoneNumber: '+8613800138000',
      text: '你好，世界！',
      smsc: '+8613800100500',
    });

    expect(pdu).toBe(
      '0891683108100005F0' + // SMSC: length 8, international, 8613800100500
        '01' + // SMS-SUBMIT
        '00' + // message reference
        '0D91683108108300F0' + // DA: 13 digits, international, 8613800138000
        '00' + // PID
        '08' + // DCS: UCS-2
        '0C' + // UDL: 12 octets
        '4F60597DFF0C4E16754CFF01',
    );
  });

  it('uses UCS-2 when Chinese is mixed with English', () => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'Hi 你好' });

    // H i space 你 好 -> 0048 0069 0020 4F60 597D (10 octets)
    expect(pdu).toBe('00' + '01' + '00' + '0C91442143658709' + '00' + '08' + '0A' + '004800690020' + '4F60597D');
  });

  it('computes TPDU length excluding the SMSC field', () => {
    const withoutSmsc = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'hello' });
    const withSmsc = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'hello', smsc: '+447785016005' });

    expect(withSmsc.length).toBe(withoutSmsc.length);
    expect(withSmsc.pdu.endsWith(withoutSmsc.pdu.slice(2))).toBe(true);
    expect(withSmsc.pdu.startsWith('07914477')).toBe(true); // len 7, international, 44 77 ...
  });

  it('uses type-of-address 0x81 for a national number', () => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '1234567890', text: 'hi' });

    // DA: length 10, type 81, digits 21 43 65 87 09
    expect(pdu).toContain('0A812143658709');
  });

  it('pads odd-length numbers with F', () => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+12345', text: 'hi' });

    // DA: length 5, international, digits 21 43 F5
    expect(pdu).toContain('05912143F5');
  });

  it('sets UDL to the septet count (not octet count) for GSM 7-bit', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text });

    // after SMSC(00) type(01) mr(00) DA(16 hex chars) pid(00) dcs(00) comes UDL
    const udl = parseInt(pdu.slice(2 + 2 + 2 + 16 + 2 + 2, 2 + 2 + 2 + 16 + 2 + 2 + 2), 16);
    expect(udl).toBe(text.length);
  });

  it('counts GSM extended characters as two septets in UDL', () => {
    const text = 'Price: 5€ [net]'; // € [ ] are each escaped with 0x1B
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text });

    const udl = parseInt(pdu.slice(2 + 2 + 2 + 16 + 2 + 2, 2 + 2 + 2 + 16 + 2 + 2 + 2), 16);
    expect(udl).toBe(text.length + 3);
    // packed user data must hold exactly ceil(udl * 7 / 8) octets
    const udOctets = (pdu.length - (2 + 2 + 2 + 16 + 2 + 2 + 2)) / 2;
    expect(udOctets).toBe(Math.ceil((udl * 7) / 8));
  });

  it('selects GSM 7-bit DCS (00) automatically for plain English', () => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'Hello, world!' });

    expect(pdu.slice(2 + 2 + 2 + 16 + 2, 2 + 2 + 2 + 16 + 4)).toBe('00');
  });

  it('honors an explicit gsm7 encoding', () => {
    const auto = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'hello' });
    const explicit = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'hello', encoding: 'gsm7' });

    expect(explicit).toEqual(auto);
  });

  it('produces an uppercase hex string with even length', () => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text: 'Test message 123' });

    expect(pdu).toMatch(/^[0-9A-F]+$/);
    expect(pdu.length % 2).toBe(0);
  });
});

describe('decodeSmsDeliverPdu', () => {
  const OA_INTL = '0C91442143658709';

  it('decodes an English sentence from a GSM 7-bit PDU', () => {
    const result = decodeSmsDeliverPdu(deliverPdu({ oa: OA_INTL, ud: HELLO_UD, udl: '05' }));

    expect(result.text).toBe('hello');
    expect(result.encoding).toBe('gsm7');
    expect(result.phoneNumber).toBe('+441234567890');
    expect(result.smsc).toBeUndefined();
  });

  it('decodes the timestamp', () => {
    const result = decodeSmsDeliverPdu(deliverPdu({ oa: OA_INTL, ud: HELLO_UD, udl: '05' }));

    expect(result.timestamp).toEqual(new Date(2025, 9, 12, 11, 22, 33));
  });

  it('decodes the SMSC when present', () => {
    const result = decodeSmsDeliverPdu(
      deliverPdu({ smsc: '0791447758100650', oa: OA_INTL, ud: HELLO_UD, udl: '05' }),
    );

    expect(result.smsc).toBe('+447785016005');
    expect(result.text).toBe('hello');
  });

  it('decodes a Chinese sentence from a UCS-2 PDU', () => {
    const result = decodeSmsDeliverPdu(
      deliverPdu({ oa: OA_INTL, dcs: '08', udl: '0C', ud: '4F60597DFF0C4E16754CFF01' }),
    );

    expect(result.text).toBe('你好，世界！');
    expect(result.encoding).toBe('ucs2');
    expect(result.phoneNumber).toBe('+441234567890');
    expect(result.timestamp).toEqual(new Date(2025, 9, 12, 11, 22, 33));
  });

  it('decodes mixed English and Chinese from a UCS-2 PDU', () => {
    const result = decodeSmsDeliverPdu(deliverPdu({ oa: OA_INTL, dcs: '08', udl: '0A', ud: '004800690020' + '4F60597D' }));

    expect(result.text).toBe('Hi 你好');
  });

  it('decodes a real message from PDU', () => {
    const body = '09A164000339941002F00414A1018618557800005468030008620122909205237C3010963F91CC4E91301160A876849A8C8BC17801662FFF1A003700340034003700370038FF0C60A86B6357288FDB884C201C77ED4FE1767B5F55201DFF0C67096548671F003100355206949F30028BF752FF6CC497327ED94EFB4F554EBA30025982975E672C4EBA64CD4F5CFF0C8BF75FFD7565672C77ED4FE13002';
    const sms = decodeSmsDeliverPdu(body);

    expect(sms.text).toBe('【阿里云】您的验证码是：744778，您正在进行“短信登录”，有效期15分钟。请勿泄露给任何人。如非本人操作，请忽略本短信。');
  });

  it('decodes a national (non-international) sender without a plus sign', () => {
    const result = decodeSmsDeliverPdu(deliverPdu({ oa: '0A812143658709', ud: HELLO_UD, udl: '05' }));

    expect(result.phoneNumber).toBe('1234567890');
  });
});

describe('encode → decode round trip (Chinese)', () => {
  it.each(['你好', '你好，世界！', '验证码：123456，请勿泄露。', 'Hi 你好', '会议改到下午3:30 😀'])('round-trips %j', (text) => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text });
    // SUBMIT: 00 | 01 | 00 | DA(16) | PID | DCS | UDL | UD
    // DELIVER: 00 | 04 | OA(16) | PID | DCS | SCTS(14) | UDL | UD
    const da = pdu.slice(6, 6 + 16);
    const pidDcs = pdu.slice(6 + 16, 6 + 16 + 4); // PID + DCS
    const udlAndUd = pdu.slice(6 + 16 + 4); // UDL + UD
    const deliver = '00' + '04' + da + pidDcs + '52012111223300' + udlAndUd;
    const decoded = decodeSmsDeliverPdu(deliver);

    expect(decoded.text).toBe(text);
    expect(decoded.encoding).toBe('ucs2');
  });
});

describe('encode → decode round trip (English)', () => {
  /** Turn a SUBMIT PDU into a DELIVER PDU by reusing the DA as the OA. */
  function submitToDeliver(submitPdu: string): string {
    // SUBMIT: 00 | 01 | 00 | DA(16) | PID | DCS | UDL | UD
    // DELIVER: 00 | 04 | OA(16) | PID | DCS | SCTS(14) | UDL | UD
    const da = submitPdu.slice(6, 6 + 16);
    const rest = submitPdu.slice(6 + 16); // PID DCS UDL UD
    const pid = rest.slice(0, 2);
    const dcs = rest.slice(2, 4);
    const udlAndUd = rest.slice(4); // UDL + UD
    return '00' + '04' + da + pid + dcs + '52012111223300' + udlAndUd;
  }

  it.each([
    'hello',
    'Hello, world!',
    'The quick brown fox jumps over the lazy dog',
    'Your verification code is 123456. Do not share it.',
    'Meeting at 3:30pm @ Room #5 (bring $20 & ID)?',
    'Price: 5€ [net] {tax} ~10% ^up |x| \\path',
    'a'.repeat(160),
  ])('round-trips %j', (text) => {
    const { pdu } = encodeSmsSubmitPdu({ phoneNumber: '+441234567890', text });
    const decoded = decodeSmsDeliverPdu(submitToDeliver(pdu));

    expect(decoded.text).toBe(text);
    expect(decoded.phoneNumber).toBe('+441234567890');
    expect(decoded.encoding).toBe('gsm7');
  });
});
