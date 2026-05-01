import { Controller, Get, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import authLogin from '../../api/auth/login';
import authRegister from '../../api/auth/register';
import authLogout from '../../api/auth/logout';
import authMe from '../../api/auth/me';
import authProfile from '../../api/auth/profile';

@Controller('api/auth')
export class AuthController {
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await authLogin(req, res);
  }

  @Post('register')
  async register(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await authRegister(req, res);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await authLogout(req, res);
  }

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await authMe(req, res);
  }

  @Put('profile')
  async profile(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    await authProfile(req, res);
  }
}
