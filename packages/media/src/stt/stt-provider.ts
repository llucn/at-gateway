// STT provider abstraction
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SttOptions {
  audioPath: string;
  language?: string;
}

export interface SttResult {
  text: string;
  confidence?: number;
}

export interface SttProvider {
  transcribe(options: SttOptions): Promise<SttResult>;
  isAvailable(): Promise<boolean>;
}

// Whisper.cpp provider (local, offline)
export class WhisperCppSttProvider implements SttProvider {
  constructor(
    private whisperBin: string = 'whisper-cli',
    private modelPath?: string,
  ) {}

  async transcribe(options: SttOptions): Promise<SttResult> {
    const modelArg = this.modelPath ? `--model ${this.modelPath}` : '';
    const langArg = options.language ? `--language ${options.language}` : '';

    // whisper.cpp expects 16kHz WAV; resample if needed
    const processedPath = options.audioPath.replace(/\.(wav|pcm)$/, '.16k.wav');
    await execAsync(
      `ffmpeg -y -i ${options.audioPath} -ar 16000 -ac 1 -sample_fmt s16 ${processedPath}`,
    );

    const cmd = `${this.whisperBin} ${modelArg} ${langArg} --no-timestamps --output-txt ${processedPath}`;
    const { stdout } = await execAsync(cmd);

    return { text: stdout.trim() };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.whisperBin} --help`);
      return true;
    } catch {
      return false;
    }
  }
}

// Faster-Whisper provider (Python, local)
export class FasterWhisperSttProvider implements SttProvider {
  constructor(
    private pythonBin: string = 'python3',
    private modelSize: string = 'small',
  ) {}

  async transcribe(options: SttOptions): Promise<SttResult> {
    // Assumes faster-whisper is installed: pip install faster-whisper
    // Create a simple Python script wrapper
    const script = `
import sys
from faster_whisper import WhisperModel

model = WhisperModel("${this.modelSize}", device="cpu", compute_type="int8")
segments, info = model.transcribe("${options.audioPath}", language="${options.language ?? 'auto'}")
text = " ".join([segment.text for segment in segments])
print(text)
`;

    const { stdout } = await execAsync(`${this.pythonBin} -c '${script}'`);
    return { text: stdout.trim() };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.pythonBin} -c "import faster_whisper"`);
      return true;
    } catch {
      return false;
    }
  }
}

// Stub providers for cloud services
export class AzureSttProvider implements SttProvider {
  constructor(
    private apiKey: string,
    private region: string,
  ) {}

  async transcribe(options: SttOptions): Promise<SttResult> {
    // TODO: Implement Azure Speech-to-Text API
    throw new Error('Azure STT not yet implemented');
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}

export class OpenAiSttProvider implements SttProvider {
  constructor(private apiKey: string) {}

  async transcribe(options: SttOptions): Promise<SttResult> {
    // TODO: Implement OpenAI Whisper API
    throw new Error('OpenAI STT not yet implemented');
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}

export class NoopSttProvider implements SttProvider {
  async transcribe(_options: SttOptions): Promise<SttResult> {
    return { text: '[STT disabled]' };
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}

// Factory
export function createSttProvider(
  provider: string,
  config: Record<string, string>,
): SttProvider {
  switch (provider) {
    case 'whisper-cpp':
      return new WhisperCppSttProvider(config['bin'], config['model']);
    case 'faster-whisper':
      return new FasterWhisperSttProvider(config['pythonBin'], config['modelSize']);
    case 'azure':
      return new AzureSttProvider(config['apiKey']!, config['region']!);
    case 'openai':
      return new OpenAiSttProvider(config['apiKey']!);
    case 'none':
    default:
      return new NoopSttProvider();
  }
}
