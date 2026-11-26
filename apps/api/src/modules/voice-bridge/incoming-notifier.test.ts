import { afterEach, describe, expect, it } from 'vitest';
import * as http from 'node:http';
import { IncomingNotifier, NotifyError, signPayload } from './incoming-notifier';

function stubSettings(values: Record<string, string>) {
  return { get: async (k: string) => values[k] ?? null } as any;
}

let server: http.Server | null = null;
afterEach(() => {
  server?.close();
  server = null;
});

async function listen(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server!.address() as any).port}/incoming`;
}

describe('IncomingNotifier', () => {
  it('posts the Twilio form with an HMAC signature and returns the parsed TwiML', async () => {
    let seen: { body: string; headers: http.IncomingHttpHeaders } | null = null;
    const url = await listen((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen = { body, headers: req.headers };
        res.setHeader('Content-Type', 'text/xml');
        res.end('<Response><Connect><Stream url="wss://app.example/connection"/></Connect></Response>');
      });
    });
    const notifier = new IncomingNotifier(stubSettings({ 'webhook.secret': 's3cret' }));
    const action = await notifier.notify(url, { callSid: 'CA' + '1'.repeat(32), from: '+8613012345678', to: '' });
    expect(action).toEqual({ type: 'stream', url: 'wss://app.example/connection' });

    const form = new URLSearchParams(seen!.body);
    expect(form.get('CallSid')).toBe('CA' + '1'.repeat(32));
    expect(form.get('From')).toBe('+8613012345678');
    expect(form.get('Direction')).toBe('inbound');
    expect(form.get('CallStatus')).toBe('ringing');
    expect(form.get('ApiVersion')).toBe('2010-04-01');
    const ts = String(seen!.headers['x-gateway-timestamp']);
    expect(seen!.headers['x-gateway-signature']).toBe(signPayload(seen!.body, 's3cret', ts));
  });

  it('fails on non-2xx and on timeout', async () => {
    const bad = await listen((_req, res) => {
      res.statusCode = 500;
      res.end();
    });
    const notifier = new IncomingNotifier(stubSettings({}));
    await expect(notifier.notify(bad, { callSid: 'CA1', from: 'x', to: '' })).rejects.toBeInstanceOf(NotifyError);
    server?.close();

    const slow = await listen(() => {
      /* never answers */
    });
    const fast = new IncomingNotifier(stubSettings({ 'webhook.timeoutMs': '200' }));
    await expect(fast.notify(slow, { callSid: 'CA2', from: 'x', to: '' })).rejects.toThrow(/timed out/);
  });
});
