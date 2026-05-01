import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import schemaAlign from '../../api/admin/schema/align';
import schemaMigrateIds from '../../api/admin/schema/migrate_ids';

@Controller('api/admin/schema')
export class AdminSchemaController {
  @Post('align')
  async align(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await schemaAlign(req, res);
  }

  @Post('migrate_ids')
  async migrateIdsPost(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await schemaMigrateIds(req, res);
  }

  @Get('migrate_ids')
  async migrateIdsGet(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await schemaMigrateIds(req, res);
  }
}
