import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Porta de src/services/kommoDb.service.js → getSyncStatus() (contagem de contatos).
 */
@Injectable()
export class KommoContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(): Promise<number> {
    return this.prisma.kommoContact.count();
  }
}
