import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';

export type AuthenticatedRequest = Request & { userId: string };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Invalid token');
    let userId: string;
    try {
      const payload: { sub?: unknown } = await this.jwt.verifyAsync(match[1], { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) throw new Error('Invalid subject');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    // A signed token can outlive its user; check existence on every protected request.
    if (!(await this.users.exists(userId))) throw new UnauthorizedException('Invalid token');
    request.userId = userId;
    return true;
  }
}
