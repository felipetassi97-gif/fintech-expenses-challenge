import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, ValidateIf, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsString() @Length(1, 500) description!: string;
  @IsString() @Matches(/^(?=\d{1,12}(?:\.\d{1,2})?$)(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/) amount!: string;
  @IsEnum(TransactionType) type!: TransactionType;
  @IsUUID() categoryId!: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}

export class UpdateTransactionDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @Length(1, 500) description?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @Matches(/^(?=\d{1,12}(?:\.\d{1,2})?$)(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/) amount?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsEnum(TransactionType) type?: TransactionType;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID() categoryId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}

export class TransactionQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ValidateIf((_object, value: unknown) => value !== undefined) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsEnum(TransactionType) type?: TransactionType;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID() categoryId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
}
