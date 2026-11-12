import { IsDateString, IsOptional, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
}
