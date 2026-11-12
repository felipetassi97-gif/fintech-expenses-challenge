import { IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateCategoryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
}
