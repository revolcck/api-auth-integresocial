import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginResponseDto,
  SelectTenantDto,
  SelectTenantResponseDto,
  RefreshTokenDto,
  loginSchema,
  selectTenantSchema,
  refreshTokenSchema,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) loginDto: LoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tenant/select')
  @HttpCode(HttpStatus.OK)
  async selectTenant(
    @Request() req,
    @Body(new ZodValidationPipe(selectTenantSchema))
    selectTenantDto: SelectTenantDto,
  ): Promise<SelectTenantResponseDto> {
    return this.authService.selectTenant(req.user.id, selectTenantDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body(new ZodValidationPipe(refreshTokenSchema))
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenSchema))
    refreshTokenDto: RefreshTokenDto,
  ): Promise<void> {
    return this.authService.logout(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
