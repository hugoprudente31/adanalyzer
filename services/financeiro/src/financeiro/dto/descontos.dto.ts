export class DescontosDto {
  qtdVendasComDesconto!: number;
  totalDesconto!: number;
  /** Média calculada só sobre as vendas que tiveram desconto > 0 — regra de negócio, não acidente. */
  descontoMedio!: number;
}
