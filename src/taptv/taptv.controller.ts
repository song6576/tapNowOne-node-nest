/**
 * TapTV 社区 HTTP 路由
 * 完整接口说明见本仓库 docs/API.md
 *
 * 注意：静态路径（如 favorites、publish）必须写在动态路径 :id 之前，
 * 否则 Nest 会把 "favorites" 当成作品 id。
 */
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

  /** GET /api/home/featured — 首页精选轮播，表 featured_banner */
  @Get('featured')
  listFeatured() {
    return this.taptvService.listFeatured();
  }
}

@Controller('api/taptv')
export class TaptvController {
  constructor(private readonly taptvService: TaptvService) {}

  /**
   * GET /api/taptv — 作品列表
   * 可选登录：登录后响应带 liked_by_me / favorited_by_me
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: ListTapTVDto, @Req() req: { user: User | null }) {
    return this.taptvService.listWorks(query, req.user ?? null);
  }

  /** POST /api/taptv/publish — 从画布项目发布作品（cover + video_url 写入 taptv_work） */
  @Post('publish')
  @UseGuards(JwtAuthGuard)
  publish(@Body() dto: PublishTapTVDto, @Req() req: { user: User }) {
    return this.taptvService.publishWork(req.user, dto);
  }

  /**
   * GET /api/taptv/favorites — 当前用户收藏列表
   * 查 taptv_favorite，按 created_at 倒序；用于个人主页「我的收藏」
   */
  @Get('favorites')
  @UseGuards(JwtAuthGuard)
  listFavorites(@Req() req: { user: User }) {
    return this.taptvService.listFavorites(req.user);
  }

  /** GET /api/taptv/:id/workflow — 作品关联画布 JSON */
  @Get(':id/workflow')
  getWorkflow(@Param('id') id: string) {
    return this.taptvService.getWorkflow(id);
  }

  /** GET /api/taptv/:id — 作品详情 */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getOne(@Param('id') id: string, @Req() req: { user: User | null }) {
    return this.taptvService.getWork(id, req.user ?? null);
  }

  /**
   * POST /api/taptv/:id/like — 切换点赞
   * 有 taptv_like 记录则取消，无则点赞；同步 taptv_work.likes
   */
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  like(@Param('id') id: string, @Req() req: { user: User }) {
    return this.taptvService.toggleLike(id, req.user);
  }

  /**
   * POST /api/taptv/:id/favorite — 切换收藏
   * 有 taptv_favorite 记录则取消，无则收藏；同步 taptv_work.favorites
   */
  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  favorite(@Param('id') id: string, @Req() req: { user: User }) {
    return this.taptvService.toggleFavorite(id, req.user);
  }

  /** POST /api/taptv/:id/share — 分享计数 +1 */
  @Post(':id/share')
  share(@Param('id') id: string) {
    return this.taptvService.recordShare(id);
  }

  /** POST /api/taptv/:id/clone — Fork 工作流到当前用户新项目 */
  @Post(':id/clone')
  @UseGuards(JwtAuthGuard)
  clone(@Param('id') id: string, @Req() req: { user: User }) {
    return this.taptvService.cloneWork(id, req.user);
  }

  /** POST /api/taptv/users/:userId/follow — 关注/取消关注作者 */
  @Post('users/:userId/follow')
  @UseGuards(JwtAuthGuard)
  follow(
    @Param('userId') userId: string,
    @Req() req: { user: User },
  ) {
    return this.taptvService.toggleFollow(Number(userId), req.user);
  }
}
