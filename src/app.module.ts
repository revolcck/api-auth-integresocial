import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { appConfig, validateConfig } from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [
    // Configuração centralizada com validação de env
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
      load: [appConfig],
    }),
    // Módulos da aplicação
    PrismaModule,
    UsersModule,
    AuthModule,
    TenantsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
