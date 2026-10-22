import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CredentialsService } from '../credentials.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private credentialsService: CredentialsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Decode Basic Auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [apiKey, apiSecret] = credentials.split(':');

    if (!apiKey || !apiSecret) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate
    const credential = await this.credentialsService.validateCredential(apiKey, apiSecret);

    if (!credential) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Attach to request for logging/tracking
    request.credential = credential;

    // Update last used timestamp (async, non-blocking)
    this.credentialsService.updateLastUsed(credential.id).catch(() => {});

    return true;
  }
}
