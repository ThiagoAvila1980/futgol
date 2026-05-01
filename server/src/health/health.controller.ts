import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import health from '../../api/health';

@Controller('api')
export class HealthController {
  @Get('health')
  async check(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await health(req, res);
  }
}
