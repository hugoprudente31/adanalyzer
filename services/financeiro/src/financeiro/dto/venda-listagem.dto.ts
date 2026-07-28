export class VendaItemDto {
  id!: number;
  clienteNome!: string | null;
  loja!: string | null;
  vendedorNome!: string | null;
  consultorResponsavel!: string | null;
  valorVenda!: number;
  desconto!: number;
  statusOs!: string | null;
  numeroOs!: string | null;
  dataAgendamento!: Date | null;
}

export class VendaListagemDto {
  total!: number;
  page!: number;
  limit!: number;
  itens!: VendaItemDto[];
}
