import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
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
