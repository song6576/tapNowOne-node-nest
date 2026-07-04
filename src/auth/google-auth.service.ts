import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { HttpsProxyAgent } from 'https-proxy-agent';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const proxyUrl = this.resolveProxyUrl();

    if (proxyUrl) {
      this.logger.log(`Google token 验证走代理: ${proxyUrl}`);
      this.client = new OAuth2Client({
        clientId,
        transporterOptions: { agent: new HttpsProxyAgent(proxyUrl) },
      });
    } else {
      this.logger.warn(
        '未配置 GOOGLE_HTTP_PROXY / HTTPS_PROXY，国内服务器可能无法验证 Google 登录',
      );
      this.client = new OAuth2Client(clientId);
    }
  }

  /** 优先 GOOGLE_HTTP_PROXY，其次 HTTPS_PROXY / HTTP_PROXY（与 npm run start:dev:proxy 一致） */
  private resolveProxyUrl(): string | undefined {
    const candidates = [
      this.config.get<string>('GOOGLE_HTTP_PROXY'),
      this.config.get<string>('HTTPS_PROXY'),
      this.config.get<string>('HTTP_PROXY'),
    ];
    return candidates.find((url) => typeof url === 'string' && url.trim())?.trim();
  }

  async verifyIdToken(credential: string): Promise<GoogleProfile> {
    const audience = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const timeoutMs = Number(this.config.get('GOOGLE_VERIFY_TIMEOUT_MS', 15000));

    try {
      const ticket = await Promise.race([
        this.client.verifyIdToken({ idToken: credential, audience }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('GOOGLE_VERIFY_TIMEOUT')),
            timeoutMs,
          ),
        ),
      ]);
      const payload = ticket.getPayload();
      return this.toProfile(payload);
    } catch (err) {
      if (err instanceof Error && err.message === 'GOOGLE_VERIFY_TIMEOUT') {
        throw new UnauthorizedException(
          '连接 Google 验证服务超时，请检查网络或代理后重试',
        );
      }
      throw new UnauthorizedException('Google 登录凭证无效或已过期');
    }
  }

  private toProfile(payload?: TokenPayload | null): GoogleProfile {
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google 账号信息不完整');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email.split('@')[0],
      picture: payload.picture,
    };
  }
}
