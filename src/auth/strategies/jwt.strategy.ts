import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { appConfig } from '../../config/app.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    const config = appConfig();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  async validate(payload: any) {
    try {
      // payload.sub contém o ID do usuário
      const user = await this.usersService.findById(payload.sub);

      // Verificar se o usuário ainda está ativo
      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Usuário inativo ou bloqueado');
      }

      // Adicionar informações do tenant se estiverem presentes no token
      if (payload.tenantId) {
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          tenantId: payload.tenantId,
          role: payload.role,
        };
      }

      // Se não houver informações de tenant, retornar apenas o usuário
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
