import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { jwtConfig } from '../config/jwt.config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register(jwtConfig)],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Aplicar JwtAuthGuard globalmente
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
