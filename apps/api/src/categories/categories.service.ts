import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { userId, ...dto } });
  }

  list(userId: string) { return this.prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } }); }

  async get(userId: string, id: string) {
    if (!isUUID(id)) throw new NotFoundException('Category not found');
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    if (!isUUID(id)) throw new NotFoundException('Category not found');
    try {
      return await this.prisma.category.update({ where: { id_userId: { id, userId } }, data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Category not found');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!isUUID(id)) throw new NotFoundException('Category not found');
    try {
      await this.prisma.category.delete({ where: { id_userId: { id, userId } } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Category not found');
      }
      throw error;
    }
  }
}
