// Chaves de cache das seções de medida.
//
// Os hooks de leitura e escrita que moravam aqui chamavam `/implement-measure-section/*`,
// uma rota que a API não tem (as seções só existem dentro da medida:
// `/implement-measure/*`). Nenhuma tela os usava; saíram junto com o serviço
// `api-client/services/implementMeasureSection.ts`. A chave fica porque
// `use-task.ts` ainda a invalida depois de salvar a tarefa.
export const implementMeasureSectionQueryKeys = {
  all: ["implementMeasureSections"] as const,
  byImplementMeasure: (implementMeasureId: string) => ["implementMeasureSections", "implementMeasure", implementMeasureId] as const,
  detail: (id: string) => ["implementMeasureSections", "detail", id] as const,
};
