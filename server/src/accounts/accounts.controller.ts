import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import accountsLookup from '../../api/accounts/lookup_by_phone';
import accountsLookupId from '../../api/accounts/lookup_by_id';

@Controller('api/accounts')
export class AccountsController {
  @Get('lookup_by_phone')
  async lookupByPhone(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await accountsLookup(req, res);
  }

  @Get('lookup_by_id')
  async lookupById(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await accountsLookupId(req, res);
  }
}
