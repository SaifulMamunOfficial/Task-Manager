import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './decorators';

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
class RefreshDto {
  @IsString() refreshToken: string;
}
class LanguageDto {
  @IsIn(['bn', 'en']) language: string;
}
class ProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) nameBn?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('profile')
  profile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @HttpCode(204)
  @Post('language')
  async language(@CurrentUser() user: AuthUser, @Body() dto: LanguageDto) {
    await this.auth.setLanguage(user.id, dto.language);
  }

  @HttpCode(204)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
