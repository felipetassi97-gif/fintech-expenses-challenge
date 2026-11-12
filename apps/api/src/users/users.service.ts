import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

const publicUser = { id: true, name: true, email: true, createdAt: true } satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, email: string, passwordHash: string) {
    try {
      return await this.prisma.user.create({ data: { name, email, passwordHash }, select: publicUser });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  }

  findPublicById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: publicUser });
  }
}
