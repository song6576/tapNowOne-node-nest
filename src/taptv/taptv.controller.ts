import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ListTapTVDto, PublishTapTVDto } from './dto/taptv.dto';
import { TaptvService } from './taptv.service';

@Controller('api/home')
export class HomeController {
  constructor(private readonly taptvService: TaptvService) {}

  @Get('featured')
  listFeatured() {
    return this.taptvService.listFeatured();
  }
}

@Controller('api/taptv')
export class TaptvController {
  constructor(private readonly taptvService: TaptvService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: ListTapTVDto, @Req() req: { user: User | null }) {
    return this.taptvService.listWorks(query, req.user ?? null);
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard)
  publish(@Body() dto: PublishTapTVDto, @Req() req: { user: User }) {
    return this.taptvService.publishWork(req.user, dto);
  }

  @Get(':id/workflow')
  getWorkflow(@Param('id') id: string) {
    return this.taptvService.getWorkflow(id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getOne(@Param('id') id: string, @Req() req: { user: User | null }) {
    return this.taptvService.getWork(id, req.user ?? null);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  like(@Param('id') id: string, @Req() req: { user: User }) {
    return this.taptvService.toggleLike(id, req.user);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  favorite(@Param('id') id: string, @Req() req: { user: User }) {
    return this.taptvService.toggleFavorite(id, req.user);
  }

  @Post(':id/share')
  share(@Param('id') id: string) {
    return this.taptvService.recordShare(id);
  }

  @Post(':id/clone')
  @UseGuards(JwtAuthGuard)
  clone(@Param('id') id: string, @Req() req: { user: User }) {
    return this.taptvService.cloneWork(id, req.user);
  }

  @Post('users/:userId/follow')
  @UseGuards(JwtAuthGuard)
  follow(
    @Param('userId') userId: string,
    @Req() req: { user: User },
  ) {
    return this.taptvService.toggleFollow(Number(userId), req.user);
  }
}
