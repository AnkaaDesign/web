import { apiClient } from "../axiosClient";

// ============================================================================
// Types — mirror DTOs in apps/api/src/modules/integrations/secullum/dto/index.ts
// ============================================================================

export interface SecullumDepartamento {
  Id: number;
  Descricao: string;
  Nfolha?: string | null;
}

export interface SecullumFuncao {
  Id: number;
  Descricao: string;
}

export interface SecullumAtividade {
  Id: number;
  Descricao: string;
  DescricaoAbreviada?: string;
  TipoDeAtividade?: number;
}

export interface SecullumHorario {
  Id: number;
  Numero: number;
  Descricao: string;
  Tipo: string;
  Desativar: boolean;
}

export interface SecullumEmpresa {
  Id: number;
  Nome: string;
  Inscricao: string;
  Documento: string;
  TipoDocumento: number;
}

export interface SecullumFuncionarioCreatePayload {
  Nome: string;
  Cpf: string;
  NumeroFolha: string;
  NumeroIdentificador?: string;
  NumeroPis?: string;
  Email?: string;
  Telefone?: string;
  Celular?: string;
  Endereco?: string;
  Bairro?: string;
  Cep?: string;
  Uf?: string;
  Admissao: string; // ISO yyyy-mm-ddT00:00:00
  EmpresaId: number;
  HorarioId: number;
  FuncaoId: number;
  DepartamentoId: number;
}

export interface SecullumFuncionarioCreateResponse {
  funcionarioId: number;
  exibirMensagemEnvioAutomatico: boolean;
}

// ============================================================================
// HTTP helpers — all routes are exposed by SecullumCadastrosController
// ============================================================================

export const secullumMappingService = {
  // Departamentos
  listDepartamentos: () =>
    apiClient
      .get<SecullumDepartamento[]>("/integrations/secullum/departamentos")
      .then((r) => r.data),
  upsertDepartamento: (body: { Id?: number; Descricao: string; Nfolha?: string | null }) =>
    apiClient
      .post<SecullumDepartamento>("/integrations/secullum/departamentos", body)
      .then((r) => r.data),
  deleteDepartamento: (id: number) =>
    apiClient.delete(`/integrations/secullum/departamentos/${id}`),

  // Funcoes
  listFuncoes: () =>
    apiClient
      .get<SecullumFuncao[]>("/integrations/secullum/funcoes")
      .then((r) => r.data),
  upsertFuncao: (body: { Id?: number; Descricao: string }) =>
    apiClient
      .post<SecullumFuncao>("/integrations/secullum/funcoes", body)
      .then((r) => r.data),
  deleteFuncao: (id: number) =>
    apiClient.delete(`/integrations/secullum/funcoes/${id}`),

  // Atividades
  listAtividades: () =>
    apiClient
      .get<SecullumAtividade[]>("/integrations/secullum/atividades")
      .then((r) => r.data),

  // Horarios (read-only list)
  listHorarios: () =>
    apiClient
      .get<SecullumHorario[]>("/integrations/secullum/horarios")
      .then((r) => r.data),

  // Mapping mutations
  linkSectorDepartamento: (sectorId: string, departamentoId: number | null) =>
    apiClient
      .post(`/integrations/secullum/mapping/sector/${sectorId}/departamento`, {
        departamentoId,
      })
      .then((r) => r.data),
  setSectorHorario: (sectorId: string, horarioId: number | null) =>
    apiClient
      .post(`/integrations/secullum/mapping/sector/${sectorId}/horario`, {
        horarioId,
      })
      .then((r) => r.data),
  linkPositionFuncao: (positionId: string, funcaoId: number | null) =>
    apiClient
      .post(`/integrations/secullum/mapping/position/${positionId}/funcao`, {
        funcaoId,
      })
      .then((r) => r.data),
  linkUserFuncionario: (userId: string, funcionarioId: number | null) =>
    apiClient
      .post(`/integrations/secullum/mapping/user/${userId}/funcionario`, {
        funcionarioId,
      })
      .then((r) => r.data),

  // Justificativas (batch delete!)
  upsertJustificativa: (body: {
    Id?: number;
    NomeAbreviado: string;
    NomeCompleto?: string;
    Ajuste?: boolean;
    Abono2?: boolean;
    Abono3?: boolean;
    Abono4?: boolean;
    Desativado?: boolean;
  }) =>
    apiClient
      .post("/integrations/secullum/justificativas", body)
      .then((r) => r.data),
  deleteJustificativas: (ids: number[]) =>
    apiClient.delete("/integrations/secullum/justificativas", { data: ids }),

  // Auxiliar
  listEmpresas: () =>
    apiClient
      .get<SecullumEmpresa[]>("/integrations/secullum/empresas")
      .then((r) => r.data),
  listMotivosDemissao: () =>
    apiClient
      .get<{ Id: number; Descricao: string }[]>("/integrations/secullum/motivos-demissao")
      .then((r) => r.data),

  // Funcionarios CRUD
  listFuncionariosLite: () =>
    apiClient
      .get("/integrations/secullum/funcionarios/lista")
      .then((r) => r.data),
  listFuncionariosDemitidos: () =>
    apiClient
      .get("/integrations/secullum/funcionarios-demitidos")
      .then((r) => r.data),
  getFuncionarioFull: (id: number) =>
    apiClient
      .get(`/integrations/secullum/funcionarios/${id}/detalhe`)
      .then((r) => r.data),
  createFuncionario: (payload: SecullumFuncionarioCreatePayload) =>
    apiClient
      .post<SecullumFuncionarioCreateResponse>("/integrations/secullum/funcionarios", payload)
      .then((r) => r.data),
  updateFuncionario: (id: number, payload: Record<string, unknown>) =>
    apiClient
      .put<SecullumFuncionarioCreateResponse>(
        `/integrations/secullum/funcionarios/${id}`,
        payload,
      )
      .then((r) => r.data),
  dismissFuncionario: (id: number, demissao: string, motivoDemissaoId?: number) =>
    apiClient
      .post(`/integrations/secullum/funcionarios/${id}/dismiss`, {
        demissao,
        motivoDemissaoId,
      })
      .then((r) => r.data),
};
