// auth/auth.controller.ts
import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] ?? '';

    const { accessToken, refreshTokenPlano } = await this.authService.login(
      dto.rutUsuario,
      dto.password,
      ip,
      userAgent,
    );

    this.setRefreshCookie(res, refreshTokenPlano);
    return { accessToken };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] ?? '';

    const { accessToken, refreshTokenPlano } = await this.authService.refrescarToken(
      refreshToken,
      ip,
      userAgent,
    );

    this.setRefreshCookie(res, refreshTokenPlano);
    return { accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) await this.authService.logout(refreshToken);
    res.clearCookie('refresh_token');
    return { ok: true };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: true, // requiere HTTPS (en desarrollo local puedes poner false)
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      path: '/auth', // solo se envía a rutas de auth
    });
  }
}
