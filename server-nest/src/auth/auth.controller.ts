// auth/auth.controller.ts
import { Controller, Post, Body, Req, Res, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-aut-guard';
import type { Entorno } from '../config/entorno';

@Controller('auth')
export class AuthController {
  /** En producción la cookie solo viaja por HTTPS (lo pone el túnel). */
  private readonly cookieSegura: boolean;

  constructor(
    private authService: AuthService,
    config: ConfigService<Entorno, true>,
  ) {
    this.cookieSegura = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /**
   * IP y navegador del visitante, recortados al largo de las columnas
   * (ip_origen 45, user_agent 255). Los navegadores dentro de apps (Facebook,
   * Instagram…) mandan user agents más largos; sin recortar, guardar la
   * sesión fallaba y el login respondía 500.
   */
  private datosCliente(req: Request) {
    return {
      ip: (req.ip ?? '').slice(0, 45),
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 255),
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { ip, userAgent } = this.datosCliente(req);

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
    const { ip, userAgent } = this.datosCliente(req);

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
    secure: this.cookieSegura,
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
    secure: this.cookieSegura,
    sameSite: 'strict',
    // Igual que la vida del refresh token en la base (REFRESH_TOKEN_DIAS).
    maxAge: this.authService.refreshTokenDias * 24 * 60 * 60 * 1000,
    // Con el prefijo global /api (main.ts) las rutas de auth viven en /api/auth.
    path: '/api/auth',
  });
}
}
