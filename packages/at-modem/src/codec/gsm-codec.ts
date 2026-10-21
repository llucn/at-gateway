// GSM 7-bit and UCS-2 codec for SMS PDU encoding

// GSM 7-bit default alphabet
const GSM7_BASIC: Record<number, string> = {
  0x00: '@', 0x01: '£', 0x02: '$', 0x03: '¥', 0x04: 'è', 0x05: 'é', 0x06: 'ù', 0x07: 'ì',
  0x08: 'ò', 0x09: 'Ç', 0x0a: '\n', 0x0b: 'Ø', 0x0c: 'ø', 0x0d: '\r', 0x0e: 'Å', 0x0f: 'å',
  0x10: 'Δ', 0x11: '_', 0x12: 'Φ', 0x13: 'Γ', 0x14: 'Λ', 0x15: 'Ω', 0x16: 'Π', 0x17: 'Ψ',
  0x18: 'Σ', 0x19: 'Θ', 0x1a: 'Ξ', 0x1b: '\x1b', 0x1c: 'Æ', 0x1d: 'æ', 0x1e: 'ß', 0x1f: 'É',
  0x20: ' ', 0x21: '!', 0x22: '"', 0x23: '#', 0x24: '¤', 0x25: '%', 0x26: '&', 0x27: "'",
  0x28: '(', 0x29: ')', 0x2a: '*', 0x2b: '+', 0x2c: ',', 0x2d: '-', 0x2e: '.', 0x2f: '/',
  0x30: '0', 0x31: '1', 0x32: '2', 0x33: '3', 0x34: '4', 0x35: '5', 0x36: '6', 0x37: '7',
  0x38: '8', 0x39: '9', 0x3a: ':', 0x3b: ';', 0x3c: '<', 0x3d: '=', 0x3e: '>', 0x3f: '?',
  0x40: '¡', 0x41: 'A', 0x42: 'B', 0x43: 'C', 0x44: 'D', 0x45: 'E', 0x46: 'F', 0x47: 'G',
  0x48: 'H', 0x49: 'I', 0x4a: 'J', 0x4b: 'K', 0x4c: 'L', 0x4d: 'M', 0x4e: 'N', 0x4f: 'O',
  0x50: 'P', 0x51: 'Q', 0x52: 'R', 0x53: 'S', 0x54: 'T', 0x55: 'U', 0x56: 'V', 0x57: 'W',
  0x58: 'X', 0x59: 'Y', 0x5a: 'Z', 0x5b: 'Ä', 0x5c: 'Ö', 0x5d: 'Ñ', 0x5e: 'Ü', 0x5f: '§',
  0x60: '¿', 0x61: 'a', 0x62: 'b', 0x63: 'c', 0x64: 'd', 0x65: 'e', 0x66: 'f', 0x67: 'g',
  0x68: 'h', 0x69: 'i', 0x6a: 'j', 0x6b: 'k', 0x6c: 'l', 0x6d: 'm', 0x6e: 'n', 0x6f: 'o',
  0x70: 'p', 0x71: 'q', 0x72: 'r', 0x73: 's', 0x74: 't', 0x75: 'u', 0x76: 'v', 0x77: 'w',
  0x78: 'x', 0x79: 'y', 0x7a: 'z', 0x7b: 'ä', 0x7c: 'ö', 0x7d: 'ñ', 0x7e: 'ü', 0x7f: 'à',
};

// GSM 7-bit extended characters (prefixed with 0x1B)
const GSM7_EXTENDED: Record<number, string> = {
  0x0a: '\f', 0x14: '^', 0x28: '{', 0x29: '}', 0x2f: '\\',
  0x3c: '[', 0x3d: '~', 0x3e: ']', 0x40: '|', 0x65: '€',
};

// Reverse lookup
const GSM7_ENCODE = new Map<string, number>();
const GSM7_EXTENDED_ENCODE = new Map<string, number>();

for (const [code, char] of Object.entries(GSM7_BASIC)) {
  GSM7_ENCODE.set(char, parseInt(code, 10));
}

for (const [code, char] of Object.entries(GSM7_EXTENDED)) {
  GSM7_EXTENDED_ENCODE.set(char, parseInt(code, 10));
}

export function isGsm7Compatible(text: string): boolean {
  for (const char of text) {
    if (!GSM7_ENCODE.has(char) && !GSM7_EXTENDED_ENCODE.has(char)) {
      return false;
    }
  }
  return true;
}

export function encodeGsm7(text: string): Buffer {
  const septets: number[] = [];

  for (const char of text) {
    if (GSM7_EXTENDED_ENCODE.has(char)) {
      septets.push(0x1b);
      septets.push(GSM7_EXTENDED_ENCODE.get(char)!);
    } else if (GSM7_ENCODE.has(char)) {
      septets.push(GSM7_ENCODE.get(char)!);
    } else {
      septets.push(0x3f); // '?' fallback
    }
  }

  // Pack 7-bit septets into octets
  const octets: number[] = [];
  let carry = 0;
  let carryBits = 0;

  for (const septet of septets) {
    octets.push(((septet << carryBits) | carry) & 0xff);
    carry = septet >> (7 - carryBits);
    carryBits++;

    if (carryBits === 7) {
      octets.push(carry);
      carry = 0;
      carryBits = 0;
    }
  }

  return Buffer.from(octets);
}

export function decodeGsm7(buffer: Buffer, length: number): string {
  const septets: number[] = [];
  let carry = 0;
  let carryBits = 0;

  for (let i = 0; i < buffer.length && septets.length < length; i++) {
    const octet = buffer[i]!;
    septets.push(((octet << carryBits) | carry) & 0x7f);
    carry = octet >> (7 - carryBits);
    carryBits++;

    if (carryBits === 7) {
      if (septets.length < length) {
        septets.push(carry);
      }
      carry = 0;
      carryBits = 0;
    }
  }

  let result = '';
  for (let i = 0; i < septets.length; i++) {
    const septet = septets[i]!;
    if (septet === 0x1b && i + 1 < septets.length) {
      const next = septets[i + 1]!;
      result += GSM7_EXTENDED[next] ?? '?';
      i++;
    } else {
      result += GSM7_BASIC[septet] ?? '?';
    }
  }

  return result;
}

export function encodeUcs2(text: string): Buffer {
  return Buffer.from(text, 'ucs2');
}

export function decodeUcs2(buffer: Buffer): string {
  return buffer.toString('ucs2');
}

// Swap nibbles for phone number encoding (BCD)
export function encodePhoneNumber(number: string): string {
  let digits = number.startsWith('+') ? number.slice(1) : number;
  if (digits.length % 2 !== 0) {
    digits += 'F';
  }

  let encoded = '';
  for (let i = 0; i < digits.length; i += 2) {
    encoded += (digits[i + 1] ?? '') + (digits[i] ?? '');
  }

  return encoded;
}

export function decodePhoneNumber(encoded: string): string {
  let number = '';
  for (let i = 0; i < encoded.length; i += 2) {
    const nibble1 = encoded[i];
    const nibble2 = encoded[i + 1];
    if (nibble2 && nibble2.toUpperCase() !== 'F') {
      number += nibble2;
    }
    if (nibble1 && nibble1.toUpperCase() !== 'F') {
      number += nibble1;
    }
  }
  return number;
}
