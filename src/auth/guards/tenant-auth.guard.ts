import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class TenantAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Primeiro, verificar a autenticação JWT padrão
    const isAuthenticated = await super.canActivate(context);

    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Verificar se o token contém informações de tenant
    if (!user.tenantId) {
      throw new ForbiddenException(
        'Token sem contexto de tenant. Selecione um tenant primeiro.',
      );
    }

    // Extrair o tenant do subdomínio da requisição
    const host = request.headers.host || '';
    const subdomain = this.extractSubdomain(host);

    // TODO: Em uma implementação completa, verificar se o subdomain corresponde ao tenantId
    // Isso exigiria um serviço que mapeie subdomínios para tenantIds

    return true;
  }

  private extractSubdomain(host: string): string {
    // Exemplo: tenant1.integresocial.cloud -> tenant1
    const parts = host.split('.');

    if (parts.length >= 3) {
      return parts[0];
    }

    return '';
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Autenticação necessária para acesso ao tenant',
        )
      );
    }
    return user;
  }
}
