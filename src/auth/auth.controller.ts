import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { GoogleLoginDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { toSafeUser } from './auth.types';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.credential);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: User }) {
    return toSafeUser(req.user);
  }
}
