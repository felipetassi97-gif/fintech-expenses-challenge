import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString() @Length(1, 120) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(8, 72) password!: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(1, 72) password!: string;
}
