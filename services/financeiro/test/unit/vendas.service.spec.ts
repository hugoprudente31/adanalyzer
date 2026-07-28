import { Prisma } from '@prisma/client';
import { VendasService } from '../../src/financeiro/services/vendas.service';
import { VendasRepository } from '../../src/financeiro/repositories/vendas.repository';

function buildService(overrides: Partial<Record<keyof VendasRepository, jest.Mock>> = {}): {
  service: VendasService;
  repo: VendasRepository;
} {
  const repo = {
    resumo: jest.fn(),
    porLoja: jest.fn(),
    porVendedor: jest.fn(),
    porConsultor: jest.fn(),
    descontos: jest.fn(),
    listar: jest.fn(),
    ...overrides,
  } as unknown as VendasRepository;
  return { service: new VendasService(repo), repo };
}

describe('VendasService — resumo (ticket médio)', () => {
  it('calcula ticket médio corretamente', async () => {
    const { service } = buildService({
      resumo: jest.fn().mockResolvedValue({ totalVendas: 4, receita: new Prisma.Decimal(2000) }),
    });
    const resumo = await service.resumo({});
    expect(resumo).toEqual({ totalVendas: 4, receita: 2000, ticketMedio: 500 });
  });

  it('devolve ticketMedio 0 (não NaN/Infinity) quando não há vendas', async () => {
    const { service } = buildService({
      resumo: jest.fn().mockResolvedValue({ totalVendas: 0, receita: null }),
    });
    const resumo = await service.resumo({});
    expect(resumo).toEqual({ totalVendas: 0, receita: 0, ticketMedio: 0 });
    expect(Number.isFinite(resumo.ticketMedio)).toBe(true);
  });
});

describe('VendasService — porLoja (bucket "Não informado")', () => {
  it('agrupa loja nula/vazia como "Não informado", e o total bate com a soma de todas as linhas', async () => {
    const { service } = buildService({
      porLoja: jest.fn().mockResolvedValue([
        { loja: 'Óticas TGT Enseada', _count: { _all: 40 }, _sum: { valorVenda: new Prisma.Decimal(47970) } },
        { loja: null, _count: { _all: 2 }, _sum: { valorVenda: new Prisma.Decimal(1800) } },
        { loja: '  ', _count: { _all: 1 }, _sum: { valorVenda: new Prisma.Decimal(500) } },
      ]),
    });

    const result = await service.porLoja({});

    expect(result).toEqual([
      { chave: 'Óticas TGT Enseada', totalVendas: 40, receita: 47970 },
      { chave: 'Não informado', totalVendas: 2, receita: 1800 },
      { chave: 'Não informado', totalVendas: 1, receita: 500 },
    ]);

    const totalGeral = result.reduce((s, r) => s + r.receita, 0);
    expect(totalGeral).toBe(47970 + 1800 + 500);
  });
});

describe('VendasService — descontos (só sobre vendas com desconto > 0)', () => {
  it('calcula a média de desconto dividindo pela quantidade de vendas COM desconto, não pelo total de vendas', async () => {
    // O repositório já filtra desconto > 0 (ver vendas.repository.ts) — aqui garantimos
    // que o service usa a quantidade retornada (das vendas com desconto), não o total geral.
    const { service } = buildService({
      descontos: jest.fn().mockResolvedValue({ qtd: 5, total: new Prisma.Decimal(500) }),
    });
    const result = await service.descontos({});
    expect(result).toEqual({ qtdVendasComDesconto: 5, totalDesconto: 500, descontoMedio: 100 });
  });

  it('devolve descontoMedio 0 quando nenhuma venda teve desconto', async () => {
    const { service } = buildService({
      descontos: jest.fn().mockResolvedValue({ qtd: 0, total: null }),
    });
    const result = await service.descontos({});
    expect(result).toEqual({ qtdVendasComDesconto: 0, totalDesconto: 0, descontoMedio: 0 });
  });
});
