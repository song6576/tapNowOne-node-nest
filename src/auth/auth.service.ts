import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResult, toSafeUser } from './auth.types';
import { GoogleAuthService } from './google-auth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: passwordHash,
        name: name?.trim() || normalizedEmail.split('@')[0],
      },
    });

    return this.buildAuthResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user?.password) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return this.buildAuthResult(user);
  }

  async loginWithGoogle(credential: string): Promise<AuthResult> {
    const profile = await this.googleAuth.verifyIdToken(credential);

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: profile.sub }, { email: profile.email }],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.sub,
          name: profile.name,
          avatarUrl: profile.picture,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.sub,
          name: user.name ?? profile.name,
          avatarUrl: user.avatarUrl ?? profile.picture,
        },
      });
    }

    return this.buildAuthResult(user);
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return toSafeUser(user);
  }

  private buildAuthResult(user: {
    id: number;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    createTime: Date;
  }): AuthResult {
    const access_token = this.jwt.sign({
      sub: user.id,
      email: user.email,
    });
    return {
      access_token,
      user: toSafeUser(user),
    };
  }
}
