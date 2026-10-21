import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTtsProvider, createSttProvider, type TtsProvider, type SttProvider } from '@at-gateway/media';

@Injectable()
export class MediaService {
  private ttsProvider: TtsProvider;
  private sttProvider: SttProvider;

  constructor(private configService: ConfigService) {
    this.ttsProvider = createTtsProvider(
      this.configService.get('TTS_PROVIDER')!,
      {
        bin: this.configService.get('TTS_PIPER_BIN')!,
        model: this.configService.get('TTS_PIPER_MODEL') || '',
        voice: this.configService.get('TTS_VOICE') || '',
        apiKey: this.configService.get('TTS_API_KEY') || '',
        region: this.configService.get('TTS_API_REGION') || '',
      },
    );

    this.sttProvider = createSttProvider(
      this.configService.get('STT_PROVIDER')!,
      {
        bin: this.configService.get('STT_WHISPER_BIN')!,
        model: this.configService.get('STT_WHISPER_MODEL') || '',
        apiKey: this.configService.get('STT_API_KEY') || '',
        region: this.configService.get('STT_API_REGION') || '',
      },
    );
  }

  getTtsProvider(): TtsProvider {
    return this.ttsProvider;
  }

  getSttProvider(): SttProvider {
    return this.sttProvider;
  }

  async synthesize(text: string, outputPath: string): Promise<string> {
    return this.ttsProvider.synthesize({ text, outputPath });
  }

  async transcribe(audioPath: string, language?: string): Promise<string> {
    const result = await this.sttProvider.transcribe({ audioPath, language });
    return result.text;
  }
}
