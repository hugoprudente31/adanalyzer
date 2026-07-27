import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard';

const REAL_KEY = 'segredo-de-teste-com-32-caracteres';

function buildContext(headerValue?: string): ExecutionContext {
  const request = { header: jest.fn().mockReturnValue(headerValue) };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard();
  const originalEnv = process.env.CRM_SERVICE_API_KEY;

  afterEach(() => {
    process.env.CRM_SERVICE_API_KEY = originalEnv;
  });

  it('permite a requisição quando o header x-api-key bate com CRM_SERVICE_API_KEY', () => {
    process.env.CRM_SERVICE_API_KEY = REAL_KEY;
    expect(guard.canActivate(buildContext(REAL_KEY))).toBe(true);
  });

  it('rejeita quando o header está ausente', () => {
    process.env.CRM_SERVICE_API_KEY = REAL_KEY;
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
  });

  it('rejeita quando o header tem o mesmo tamanho da chave real mas valor errado', () => {
    process.env.CRM_SERVICE_API_KEY = REAL_KEY;
    const wrongSameLength = 'x'.repeat(REAL_KEY.length);
    expect(() => guard.canActivate(buildContext(wrongSameLength))).toThrow(UnauthorizedException);
  });

  it('rejeita quando o header tem tamanho diferente da chave real', () => {
    process.env.CRM_SERVICE_API_KEY = REAL_KEY;
    expect(() => guard.canActivate(buildContext('curto'))).toThrow(UnauthorizedException);
  });

  it('rejeita (em vez de deixar passar) quando CRM_SERVICE_API_KEY não está configurado no servidor', () => {
    delete process.env.CRM_SERVICE_API_KEY;
    expect(() => guard.canActivate(buildContext('qualquer-coisa'))).toThrow(UnauthorizedException);
  });
});
