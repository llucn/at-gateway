import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SettingsService } from '../settings/settings.service';
import { parseTwiml, type TwimlAction } from './twiml';

export const API_VERSION = '2010-04-01';

/** Twilio-style SID: 2-letter prefix + 32 hex characters. */
export function newSid(prefix: 'CA' | 'AC' | 'MZ'): string {
  return prefix + crypto.randomBytes(16).toString('hex');
}

/** Fixed AccountSid reported to the application. */
export const ACCOUNT_SID = 'AC' + '0'.repeat(32);

export function signPayload(payload: string, secret: string, timestamp: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

export interface IncomingCallParams {
  callSid: string;
  from: string;
  to: string;
}

export class NotifyError extends Error {}

@Injectable()
export class IncomingNotifier {
  private readonly logger = new Logger(IncomingNotifier.name);

  constructor(private settings: SettingsService) {}

  async getUrl(): Promise<string | null> {
    return (await this.settings.get('voice.incomingUrl'))?.trim() || null;
  }

  /** POST the Twilio-style incoming-call form to `url` and return the parsed TwiML verb. */
  async notify(url: string, params: IncomingCallParams): Promise<TwimlAction> {
    const body = new URLSearchParams({
      CallSid: params.callSid,
      AccountSid: ACCOUNT_SID,
      From: params.from,
      To: params.to,
      CallStatus: 'ringing',
      Direction: 'inbound',
      ApiVersion: API_VERSION,
    }).toString();

    const secret = (await this.settings.get('webhook.secret')) || '';
    const timeoutMs = Number(await this.settings.get('webhook.timeoutMs')) || 5000;
    const timestamp = Date.now().toString();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Gateway-Signature': signPayload(body, secret, timestamp),
          'X-Gateway-Timestamp': timestamp,
          'X-Gateway-Event': 'call.incoming',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e: any) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      throw new NotifyError(
        timedOut ? `Notification timed out after ${timeoutMs}ms` : `Notification failed: ${e?.message ?? e}`,
      );
    }
    if (!res.ok) throw new NotifyError(`Notification returned HTTP ${res.status}`);

    const action = parseTwiml(await res.text());
    if (action.type === 'none' && action.ignored.length > 0) {
      this.logger.warn(`Ignoring unsupported TwiML verbs: ${action.ignored.join(', ')}`);
    }
    return action;
  }
}
