import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & { userId: string };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Invalid token');
    try {
      const payload: { sub?: unknown } = await this.jwt.verifyAsync(match[1], { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) throw new Error('Invalid subject');
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
