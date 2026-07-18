import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToggleMediaFavoriteDto } from './dto/media-favorite.dto';
import { FavoritesService } from './favorites.service';

@Controller('api/media-favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /** GET /api/media-favorites — 画布素材收藏列表 */
  @Get()
  list(@Req() req: { user: User }) {
    return this.favoritesService.listMedia(req.user);
  }

  /** GET /api/media-favorites/status?url= — 某素材是否已收藏 */
  @Get('status')
  status(@Query('url') url: string, @Req() req: { user: User }) {
    return this.favoritesService.mediaStatus(req.user, url ?? '');
  }

  /** POST /api/media-favorites/toggle — 收藏 / 取消收藏 */
  @Post('toggle')
  toggle(@Body() dto: ToggleMediaFavoriteDto, @Req() req: { user: User }) {
    return this.favoritesService.toggleMedia(req.user, dto);
  }
}
