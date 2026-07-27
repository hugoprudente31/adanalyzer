import { PipelinesService } from '../../src/crm/services/pipelines.service';
import { KommoPipelineRepository, PipelineRow, PipelineStatusRow } from '../../src/crm/repositories/kommo-pipeline.repository';
import { KommoLeadRepository } from '../../src/crm/repositories/kommo-lead.repository';

describe('PipelinesService — classificação isWon/isLost (WON_PATTERN/LOST_PATTERN)', () => {
  const pipelines: PipelineRow[] = [{ id: 1n, name: 'TGT Ademar de Barros', sort: 1 }];

  // Nomes de status reais observados na conta Kommo (ver src/services/kommoDb.service.js)
  const statuses: PipelineStatusRow[] = [
    { id: 101n, pipelineId: 1n, name: 'Venda ganha', sort: 1, color: '#0f0' },
    { id: 102n, pipelineId: 1n, name: 'Venda perdida', sort: 2, color: '#f00' },
    { id: 103n, pipelineId: 1n, name: 'Venda Fechada', sort: 3, color: '#0f0' },
    { id: 104n, pipelineId: 1n, name: 'Em contato', sort: 4, color: '#999' },
    { id: 105n, pipelineId: 1n, name: 'Agendamento', sort: 5, color: '#99f' },
  ];

  function buildService(): PipelinesService {
    const pipelineRepository = {
      findAllPipelines: jest.fn().mockResolvedValue(pipelines),
      findAllStatuses: jest.fn().mockResolvedValue(statuses),
    } as unknown as KommoPipelineRepository;
    const leadRepository = {} as KommoLeadRepository;
    return new PipelinesService(pipelineRepository, leadRepository);
  }

  it('classifica "Venda ganha" e "Venda Fechada" como isWon', async () => {
    const [pipeline] = await buildService().getPipelinesWithStages();
    const ganha = pipeline.statuses.find((s) => s.name === 'Venda ganha')!;
    const fechada = pipeline.statuses.find((s) => s.name === 'Venda Fechada')!;

    expect(ganha.isWon).toBe(true);
    expect(ganha.isLost).toBe(false);
    expect(fechada.isWon).toBe(true);
    expect(fechada.isLost).toBe(false);
  });

  it('classifica "Venda perdida" como isLost', async () => {
    const [pipeline] = await buildService().getPipelinesWithStages();
    const perdida = pipeline.statuses.find((s) => s.name === 'Venda perdida')!;

    expect(perdida.isLost).toBe(true);
    expect(perdida.isWon).toBe(false);
  });

  it('não classifica estágios neutros ("Em contato", "Agendamento") como ganho nem perdido', async () => {
    const [pipeline] = await buildService().getPipelinesWithStages();
    const emContato = pipeline.statuses.find((s) => s.name === 'Em contato')!;
    const agendamento = pipeline.statuses.find((s) => s.name === 'Agendamento')!;

    expect(emContato.isWon).toBe(false);
    expect(emContato.isLost).toBe(false);
    expect(agendamento.isWon).toBe(false);
    expect(agendamento.isLost).toBe(false);
  });

  it('devolve o id do pipeline e do status como string (não bigint/number)', async () => {
    const [pipeline] = await buildService().getPipelinesWithStages();
    expect(pipeline.id).toBe('1');
    expect(pipeline.statuses[0].id).toBe('101');
  });
});
