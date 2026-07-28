/**
 * Dois números reais, lado a lado — NUNCA subtraídos. Não existe custo real
 * (folha, aluguel, CMV) nesse sistema; calcular "lucro"/"margem" a partir
 * só do gasto de anúncio seria enganoso. Ver README.md, "Fora de escopo".
 */
export class ComparativoDto {
  receita!: number;
  gastoAnuncios!: {
    google: number;
    facebook: number;
    total: number;
  };
}
