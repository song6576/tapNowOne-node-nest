import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ComposeService } from './compose.service';
import { ComposeDto } from './dto/compose.dto';

@Controller('api/compose')
@UseGuards(JwtAuthGuard)
export class ComposeController {
  constructor(private readonly composeService: ComposeService) {}

  @Post()
  submit(@Body() dto: ComposeDto, @Req() req: { user: User }) {
    return this.composeService.submit(dto, req.user.id);
  }
}
