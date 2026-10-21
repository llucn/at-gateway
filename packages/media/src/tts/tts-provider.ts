// TTS provider abstraction
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

export interface TtsOptions {
  text: string;
  voice?: string;
  language?: string;
  outputPath: string;
}

export interface TtsProvider {
  synthesize(options: TtsOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// Piper TTS provider (local, offline)
export class PiperTtsProvider implements TtsProvider {
  constructor(
    private piperBin: string = 'piper',
    private modelPath?: string,
  ) {}

  async synthesize(options: TtsOptions): Promise<string> {
    const modelArg = this.modelPath ? `--model ${this.modelPath}` : '';
    const voiceArg = options.voice ? `--speaker ${options.voice}` : '';

    // Piper outputs raw audio; we need to convert to 8kHz 16-bit mono WAV
    const tempOut = options.outputPath.replace(/\.wav$/, '.temp.wav');

    const cmd = `echo "${options.text}" | ${this.piperBin} ${modelArg} ${voiceArg} --output_file ${tempOut}`;
    await execAsync(cmd);

    // Resample to 8kHz mono using ffmpeg
    await execAsync(
      `ffmpeg -y -i ${tempOut} -ar 8000 -ac 1 -sample_fmt s16 ${options.outputPath}`,
    );

    return options.outputPath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.piperBin} --version`);
      return true;
    } catch {
      return false;
    }
  }
}

// Edge TTS provider (free, cloud)
export class EdgeTtsProvider implements TtsProvider {
  constructor(private voice: string = 'zh-CN-XiaoxiaoNeural') {}

  async synthesize(options: TtsOptions): Promise<string> {
    const voice = options.voice ?? this.voice;

    // edge-tts Python package
    const tempOut = options.outputPath.replace(/\.wav$/, '.temp.mp3');
    await execAsync(`edge-tts --voice "${voice}" --text "${options.text}" --write-media ${tempOut}`);

    // Convert to 8kHz WAV
    await execAsync(
      `ffmpeg -y -i ${tempOut} -ar 8000 -ac 1 -sample_fmt s16 ${options.outputPath}`,
    );

    return options.outputPath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('edge-tts --version');
      return true;
    } catch {
      return false;
    }
  }
}

// Stub providers for Azure/OpenAI (require API keys)
export class AzureTtsProvider implements TtsProvider {
  constructor(
    private apiKey: string,
    private region: string,
    private voice: string = 'zh-CN-XiaoxiaoNeural',
  ) {}

  async synthesize(options: TtsOptions): Promise<string> {
    // TODO: Implement Azure Cognitive Services TTS API
    throw new Error('Azure TTS not yet implemented');
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}

export class OpenAiTtsProvider implements TtsProvider {
  constructor(
    private apiKey: string,
    private voice: string = 'nova',
  ) {}

  async synthesize(options: TtsOptions): Promise<string> {
    // TODO: Implement OpenAI TTS API
    throw new Error('OpenAI TTS not yet implemented');
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}

export class NoopTtsProvider implements TtsProvider {
  async synthesize(_options: TtsOptions): Promise<string> {
    throw new Error('TTS is disabled');
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}

// Factory
export function createTtsProvider(
  provider: string,
  config: Record<string, string>,
): TtsProvider {
  switch (provider) {
    case 'piper':
      return new PiperTtsProvider(config['bin'], config['model']);
    case 'edge':
      return new EdgeTtsProvider(config['voice']);
    case 'azure':
      return new AzureTtsProvider(config['apiKey']!, config['region']!, config['voice']);
    case 'openai':
      return new OpenAiTtsProvider(config['apiKey']!, config['voice']);
    case 'none':
    default:
      return new NoopTtsProvider();
  }
}
