import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto } from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTransactionDto) { return this.transactions.create(req.userId, dto); }
  @Get() list(@Req() req: AuthenticatedRequest, @Query() query: TransactionQueryDto) { return this.transactions.list(req.userId, query); }
  @Get(':id') get(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.transactions.get(req.userId, id); }
  @Patch(':id') update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateTransactionDto) { return this.transactions.update(req.userId, id, dto); }
  @Delete(':id') remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.transactions.remove(req.userId, id); }
}
