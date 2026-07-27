import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Autenticação mínima deste serviço: um único segredo compartilhado no header
 * `x-api-key`, comparado em tempo constante — mesma técnica do safeEqual() em
 * src/middleware/security.js (Basic Auth do app Express).
 *
 * Isto é DELIBERADAMENTE um placeholder, não um sistema de RBAC. Não existe
 * identidade de usuário nem papéis aqui — ver README.md, seção "Fora de escopo".
 */
function safeEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CRM_SERVICE_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('CRM_SERVICE_API_KEY não configurado no servidor.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-api-key');
    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('x-api-key inválido ou ausente.');
    }

    return true;
  }
}
