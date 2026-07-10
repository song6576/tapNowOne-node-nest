import { Controller, Get, Query } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller('api/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  /**
   * GET /api/models
   * Query: category=text|video|audio, node_type=text|image|video|audio
   */
  @Get()
  list(
    @Query('category') category?: string,
    @Query('node_type') nodeType?: string,
  ) {
    return this.modelsService.list({ category, nodeType });
  }
}
