import { IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateCategoryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @Length(1, 120) @Matches(/\S/) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
}
