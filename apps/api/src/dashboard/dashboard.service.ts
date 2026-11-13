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
    const hasComparisonStart = Boolean(query.comparisonStartDate);
    const hasComparisonEnd = Boolean(query.comparisonEndDate);
    if (hasComparisonStart !== hasComparisonEnd) {
      throw new BadRequestException('comparisonStartDate and comparisonEndDate must be provided together');
    }
    if (hasComparisonStart && (!query.startDate || !query.endDate)) {
      throw new BadRequestException('comparison requires startDate and endDate for the selected period');
    }
    if (query.comparisonStartDate && query.comparisonEndDate) {
      if (query.comparisonStartDate > query.comparisonEndDate) {
        throw new BadRequestException('comparisonStartDate must be before or equal to comparisonEndDate');
      }
      if (query.startDate && query.comparisonEndDate >= query.startDate) {
        throw new BadRequestException('comparison period must end before the selected period');
      }
    }

    const dateRange = (startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined => {
      if (!startDate && !endDate) return undefined;
      return {
        ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
        ...(endDate ? { lte: new Date(`${endDate}T00:00:00.000Z`) } : {}),
      };
    };
    const selectedDate = dateRange(query.startDate, query.endDate);
    const comparisonDate = dateRange(query.comparisonStartDate, query.comparisonEndDate);
    const period = { userId, ...(selectedDate ? { date: selectedDate } : {}) };
    const comparisonPeriod = comparisonDate ? { userId, date: comparisonDate } : null;
    const endingBalancePeriod = query.endDate
      ? { userId, date: { lte: new Date(`${query.endDate}T00:00:00.000Z`) } }
      : { userId };
    const comparisonBalancePeriod = query.comparisonEndDate
      ? { userId, date: { lte: new Date(`${query.comparisonEndDate}T00:00:00.000Z`) } }
      : null;
    // Transactions are calendar dates; define the business day in São Paulo.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const currentBalancePeriod = { userId, date: { lte: new Date(`${today}T00:00:00.000Z`) } };

    return this.prisma.$transaction(async (db) => {
      if (!await db.user.findUnique({ where: { id: userId }, select: { id: true } })) {
        throw new UnauthorizedException('Invalid token');
      }
      const [historical, totals, categories, comparisonTotals, endingBalance, comparisonBalance, currentBalance] = await Promise.all([
        db.transaction.groupBy({ by: ['type'], where: { userId }, _sum: { amount: true } }),
        db.transaction.groupBy({ by: ['type'], where: period, _sum: { amount: true } }),
        db.transaction.groupBy({
          by: ['categoryId'], where: { ...period, type: TransactionType.EXPENSE },
          _sum: { amount: true }, orderBy: [{ _sum: { amount: 'desc' } }, { categoryId: 'asc' }], take: 3,
        }),
        comparisonPeriod
          ? db.transaction.groupBy({ by: ['type'], where: comparisonPeriod, _sum: { amount: true } })
          : Promise.resolve([]),
        db.transaction.groupBy({ by: ['type'], where: endingBalancePeriod, _sum: { amount: true } }),
        comparisonBalancePeriod
          ? db.transaction.groupBy({ by: ['type'], where: comparisonBalancePeriod, _sum: { amount: true } })
          : Promise.resolve([]),
        db.transaction.groupBy({ by: ['type'], where: currentBalancePeriod, _sum: { amount: true } }),
      ]);
      const amount = (rows: typeof historical, type: TransactionType) =>
        rows.find((row) => row.type === type)?._sum.amount ?? new Prisma.Decimal(0);
      const balanceFrom = (rows: typeof historical) =>
        amount(rows, TransactionType.INCOME).minus(amount(rows, TransactionType.EXPENSE));
      const percentChange = (current: Prisma.Decimal, previous: Prisma.Decimal) =>
        previous.isZero() ? null : current.minus(previous).div(previous.abs()).mul(100).toDecimalPlaces(1).toFixed(1);
      const change = (current: Prisma.Decimal, previous: Prisma.Decimal | null) => {
        if (!previous) return { value: null, amountDifference: null, status: 'unavailable' as const, direction: 'flat' as const };
        const amountDifference = current.minus(previous).toFixed(2);
        if (previous.isZero()) {
          return current.isZero()
            ? { value: null, amountDifference, status: 'no_baseline' as const, direction: 'flat' as const }
            : { value: null, amountDifference, status: 'new' as const, direction: current.gt(0) ? 'up' as const : 'down' as const };
        }
        return {
          value: percentChange(current, previous),
          amountDifference,
          status: 'available' as const,
          direction: current.gt(previous) ? 'up' as const : current.lt(previous) ? 'down' as const : 'flat' as const,
        };
      };
      const names = await db.category.findMany({
        where: { userId, id: { in: categories.map((category) => category.categoryId) } },
        select: { id: true, name: true },
      });
      const categoryNames = new Map(names.map((category) => [category.id, category.name]));
      const income = amount(totals, TransactionType.INCOME);
      const expense = amount(totals, TransactionType.EXPENSE);
      const comparisonIncome = comparisonPeriod ? amount(comparisonTotals, TransactionType.INCOME) : null;
      const comparisonExpense = comparisonPeriod ? amount(comparisonTotals, TransactionType.EXPENSE) : null;
      const balanceAtEnd = balanceFrom(endingBalance);
      const previousBalance = comparisonBalancePeriod ? balanceFrom(comparisonBalance) : null;
      const incomeGrowth = change(income, comparisonIncome);
      const expenseVariation = change(expense, comparisonExpense);
      return {
        balance: balanceFrom(currentBalance).toFixed(2),
        historicalBalance: balanceFrom(historical).toFixed(2),
        balanceAtEnd: balanceAtEnd.toFixed(2),
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        comparison: comparisonPeriod && comparisonIncome && comparisonExpense && previousBalance
          ? {
              startDate: query.comparisonStartDate,
              endDate: query.comparisonEndDate,
              balance: previousBalance.toFixed(2),
              income: comparisonIncome.toFixed(2),
              expense: comparisonExpense.toFixed(2),
            }
          : null,
        changes: {
          balance: change(balanceAtEnd, previousBalance),
          income: incomeGrowth,
          expense: expenseVariation,
        },
        periodIndicators: {
          incomeGrowth,
          expenseVariation,
          operationalParticipation: income.isZero()
            ? null
            : expense.div(income).mul(100).toDecimalPlaces(1).toFixed(1),
          periodResult: income.minus(expense).toFixed(2),
        },
        topCategories: categories.map((category) => ({
          categoryId: category.categoryId,
          name: categoryNames.get(category.categoryId),
          amount: (category._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
