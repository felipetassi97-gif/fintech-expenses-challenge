import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, Length, MaxLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 120) name!: string;
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(8, 72) @IsByteLength(1, 72) password!: string;
}

export class LoginDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(1, 72) @IsByteLength(1, 72) password!: string;
}
