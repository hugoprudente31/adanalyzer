import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Envelopa toda resposta de sucesso como { success: true, data }, igual ao
 * padrão já usado em src/routes/kommoDb.routes.js e em services/crm.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, { success: true; data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<{ success: true; data: T }> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
