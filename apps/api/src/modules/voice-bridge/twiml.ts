// Minimal TwiML parser: only <Connect><Stream url/>, <Hangup/> and <Reject/> are supported.

export type TwimlAction =
  | { type: 'stream'; url: string }
  | { type: 'hangup' }
  | { type: 'reject' }
  | { type: 'none'; ignored: string[] }
  | { type: 'invalid'; reason: string };

const SUPPORTED = new Set(['Response', 'Connect', 'Stream', 'Hangup', 'Reject']);

function decodeXml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Returns the first executable verb in document order; unsupported verbs are reported in `ignored`. */
export function parseTwiml(xml: string): TwimlAction {
  const body = xml.replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const tagRe = /<\s*([A-Za-z][A-Za-z0-9]*)([^>]*?)(\/?)>/g;
  const ignored: string[] = [];
  let inConnect = false;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body))) {
    const name = m[1]!;
    const attrs = m[2]!;
    if (!SUPPORTED.has(name)) {
      ignored.push(name);
      continue;
    }
    if (name === 'Connect') {
      inConnect = !m[3];
    } else if (name === 'Stream' && inConnect) {
      const u = attrs.match(/\burl\s*=\s*(?:"([^"]*)"|'([^']*)')/);
      const url = decodeXml((u?.[1] ?? u?.[2] ?? '').trim());
      if (!url) return { type: 'invalid', reason: 'Stream url is missing' };
      if (!/^wss?:\/\//i.test(url)) {
        return { type: 'invalid', reason: `Stream url must be ws:// or wss:// (got ${url})` };
      }
      return { type: 'stream', url };
    } else if (name === 'Hangup') {
      return { type: 'hangup' };
    } else if (name === 'Reject') {
      return { type: 'reject' };
    }
  }
  return { type: 'none', ignored };
}
