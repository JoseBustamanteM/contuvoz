// auth/auth.controller.ts
// auth/auth.controller.ts
import { Controller, Post, Body, Req, Res, Get, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express'; // 👈 cambio aquí
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-aut-guard';

// el resto del archivo queda igual

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? '';
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
    const ip = req.ip ?? '';
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
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth', // debe coincidir con setRefreshCookie
  });
  return { ok: true };
}

@UseGuards(JwtAuthGuard)
@Get('me')
async me(@Req() req: Request) {
  const { idUsuario } = req.user as { idUsuario: number };
  return this.authService.obtenerUsuario(idUsuario);
}

  private setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // 👈 false en dev, true en prod
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    // Con el prefijo global /api (main.ts) las rutas de auth viven en /api/auth.
    path: '/api/auth',
  });
}
}
