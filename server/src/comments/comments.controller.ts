import { Controller, Delete, Get, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import commentsIndex from '../../api/comments';
import commentsId from '../../api/comments/[id]';

@Controller('api/comments')
export class CommentsController {
  @Get()
  async index(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await commentsIndex(req, res);
  }

  @Put(':id')
  async update(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await commentsId(req, res);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await commentsId(req, res);
  }
}
