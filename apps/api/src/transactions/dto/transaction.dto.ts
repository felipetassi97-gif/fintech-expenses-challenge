import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsString() @Length(1, 500) description!: string;
  @IsString() @Matches(/^(?=\d{1,12}(?:\.\d{1,2})?$)(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/) amount!: string;
  @IsEnum(TransactionType) type!: TransactionType;
  @IsUUID() categoryId!: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}

export class UpdateTransactionDto {
  @IsOptional() @IsString() @Length(1, 500) description?: string;
  @IsOptional() @IsString() @Matches(/^(?=\d{1,12}(?:\.\d{1,2})?$)(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/) amount?: string;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}

export class TransactionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
}
