import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Transaction } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto } from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private format(transaction: Transaction) {
    return { id: transaction.id, categoryId: transaction.categoryId, description: transaction.description, type: transaction.type, amount: transaction.amount.toFixed(2), date: transaction.date.toISOString().slice(0, 10) };
  }

  private async category(userId: string, id: string) {
    if (!await this.prisma.category.findFirst({ where: { id, userId }, select: { id: true } })) {
      throw new NotFoundException('Category not found');
    }
  }

  async create(userId: string, dto: CreateTransactionDto) {
    await this.category(userId, dto.categoryId);
    try {
      return this.format(await this.prisma.transaction.create({ data: { ...dto, userId, date: new Date(`${dto.date}T00:00:00.000Z`) } }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new NotFoundException('Category not found');
      throw error;
    }
  }

  async list(userId: string, query: TransactionQueryDto) {
    if (query.startDate && query.endDate && query.startDate > query.endDate) throw new BadRequestException('Invalid date range');
    const where: Prisma.TransactionWhereInput = {
      userId, type: query.type, categoryId: query.categoryId,
      date: query.startDate || query.endDate ? {
        gte: query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : undefined,
        lte: query.endDate ? new Date(`${query.endDate}T00:00:00.000Z`) : undefined,
      } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.transaction.count({ where }),
    ]);
    return { data: items.map(item => this.format(item)), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async get(userId: string, id: string) {
    if (!isUUID(id)) throw new NotFoundException('Transaction not found');
    const item = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Transaction not found');
    return this.format(item);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.get(userId, id);
    if (dto.categoryId !== undefined) await this.category(userId, dto.categoryId);
    try {
      const result = await this.prisma.transaction.updateMany({ where: { id, userId }, data: { ...dto, date: dto.date === undefined ? undefined : new Date(`${dto.date}T00:00:00.000Z`) } });
      if (!result.count) throw new NotFoundException('Transaction not found');
      return this.get(userId, id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new NotFoundException('Category not found');
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    if (!isUUID(id)) throw new NotFoundException('Transaction not found');
    const result = await this.prisma.transaction.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Transaction not found');
    return { deleted: true };
  }
}
