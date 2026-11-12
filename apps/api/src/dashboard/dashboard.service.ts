import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { DashboardQueryDto } from './dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string, query: DashboardQueryDto) {
    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }
    const date: Prisma.DateTimeFilter = {};
    if (query.startDate) date.gte = new Date(`${query.startDate}T00:00:00.000Z`);
    if (query.endDate) date.lte = new Date(`${query.endDate}T00:00:00.000Z`);
    const period = { userId, ...(query.startDate || query.endDate ? { date } : {}) };

    return this.prisma.$transaction(async (db) => {
      if (!await db.user.findUnique({ where: { id: userId }, select: { id: true } })) {
        throw new UnauthorizedException('Invalid token');
      }
      const [historical, totals, categories] = await Promise.all([
        db.transaction.groupBy({ by: ['type'], where: { userId }, _sum: { amount: true } }),
        db.transaction.groupBy({ by: ['type'], where: period, _sum: { amount: true } }),
        db.transaction.groupBy({
          by: ['categoryId'], where: { ...period, type: TransactionType.EXPENSE },
          _sum: { amount: true }, orderBy: [{ _sum: { amount: 'desc' } }, { categoryId: 'asc' }], take: 3,
        }),
      ]);
      const amount = (rows: typeof historical, type: TransactionType) =>
        rows.find((row) => row.type === type)?._sum.amount ?? new Prisma.Decimal(0);
      const names = await db.category.findMany({
        where: { userId, id: { in: categories.map((category) => category.categoryId) } },
        select: { id: true, name: true },
      });
      const categoryNames = new Map(names.map((category) => [category.id, category.name]));
      return {
        balance: amount(historical, TransactionType.INCOME).minus(amount(historical, TransactionType.EXPENSE)).toFixed(2),
        income: amount(totals, TransactionType.INCOME).toFixed(2),
        expense: amount(totals, TransactionType.EXPENSE).toFixed(2),
        topCategories: categories.map((category) => ({
          categoryId: category.categoryId,
          name: categoryNames.get(category.categoryId),
          amount: (category._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
