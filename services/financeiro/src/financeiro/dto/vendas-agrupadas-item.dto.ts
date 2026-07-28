/**
 * Item genérico de agrupamento (por loja, vendedor ou consultor) — mesma
 * forma nos três casos, só muda qual coluna virou `chave`.
 */
export class VendasAgrupadasItemDto {
  chave!: string;
  totalVendas!: number;
  receita!: number;
}
