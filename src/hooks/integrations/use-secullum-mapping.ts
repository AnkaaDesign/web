import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { secullumMappingService } from "../../api-client/services/secullum-mapping";
import { toast } from "@/components/ui/sonner";

export const secullumMappingKeys = {
  all: ["secullum-mapping"] as const,
  departamentos: () => [...secullumMappingKeys.all, "departamentos"] as const,
  funcoes: () => [...secullumMappingKeys.all, "funcoes"] as const,
  atividades: () => [...secullumMappingKeys.all, "atividades"] as const,
  horarios: () => [...secullumMappingKeys.all, "horarios"] as const,
  empresas: () => [...secullumMappingKeys.all, "empresas"] as const,
  motivosDemissao: () => [...secullumMappingKeys.all, "motivos-demissao"] as const,
  funcionariosLite: () => [...secullumMappingKeys.all, "funcionarios-lite"] as const,
  funcionariosDemitidos: () => [...secullumMappingKeys.all, "funcionarios-demitidos"] as const,
};

// =================== Horarios ===================

export const useSecullumHorarios = () =>
  useQuery({
    queryKey: secullumMappingKeys.horarios(),
    queryFn: () => secullumMappingService.listHorarios(),
    staleTime: 60_000,
  });

// =================== Link mutations (write back to Ankaa side) ===================

export const useLinkSectorDepartamento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sectorId: string; departamentoId: number | null }) =>
      secullumMappingService.linkSectorDepartamento(vars.sectorId, vars.departamentoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sectors"] as const });
      qc.invalidateQueries({ queryKey: secullumMappingKeys.departamentos() });
    },
  });
};

export const useSetSectorHorario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sectorId: string; horarioId: number | null }) =>
      secullumMappingService.setSectorHorario(vars.sectorId, vars.horarioId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sectors"] as const });
    },
  });
};

export const useLinkPositionFuncao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { positionId: string; funcaoId: number | null }) =>
      secullumMappingService.linkPositionFuncao(vars.positionId, vars.funcaoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positions"] as const });
      qc.invalidateQueries({ queryKey: secullumMappingKeys.funcoes() });
    },
  });
};

// =================== Departamentos ===================

export const useSecullumDepartamentos = () =>
  useQuery({
    queryKey: secullumMappingKeys.departamentos(),
    queryFn: () => secullumMappingService.listDepartamentos(),
    staleTime: 60_000,
  });

export const useUpsertSecullumDepartamento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { Id?: number; Descricao: string; Nfolha?: string | null }) =>
      secullumMappingService.upsertDepartamento(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: secullumMappingKeys.departamentos() }),
  });
};

export const useDeleteSecullumDepartamento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => secullumMappingService.deleteDepartamento(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: secullumMappingKeys.departamentos() }),
  });
};

// =================== Funcoes ===================

export const useSecullumFuncoes = () =>
  useQuery({
    queryKey: secullumMappingKeys.funcoes(),
    queryFn: () => secullumMappingService.listFuncoes(),
    staleTime: 60_000,
  });

export const useUpsertSecullumFuncao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { Id?: number; Descricao: string }) =>
      secullumMappingService.upsertFuncao(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: secullumMappingKeys.funcoes() }),
  });
};

export const useDeleteSecullumFuncao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => secullumMappingService.deleteFuncao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: secullumMappingKeys.funcoes() }),
  });
};

// =================== Atividades / Auxiliar ===================

export const useSecullumAtividades = () =>
  useQuery({
    queryKey: secullumMappingKeys.atividades(),
    queryFn: () => secullumMappingService.listAtividades(),
    staleTime: 60_000,
  });

export const useSecullumEmpresas = () =>
  useQuery({
    queryKey: secullumMappingKeys.empresas(),
    queryFn: () => secullumMappingService.listEmpresas(),
    staleTime: 5 * 60_000,
  });

export const useSecullumMotivosDemissao = () =>
  useQuery({
    queryKey: secullumMappingKeys.motivosDemissao(),
    queryFn: () => secullumMappingService.listMotivosDemissao(),
    staleTime: 5 * 60_000,
  });

// =================== Funcionarios (lite + demitidos) ===================

export const useSecullumFuncionariosLite = () =>
  useQuery({
    queryKey: secullumMappingKeys.funcionariosLite(),
    queryFn: () => secullumMappingService.listFuncionariosLite(),
    staleTime: 30_000,
  });

export const useSecullumFuncionariosDemitidos = () =>
  useQuery({
    queryKey: secullumMappingKeys.funcionariosDemitidos(),
    queryFn: () => secullumMappingService.listFuncionariosDemitidos(),
    staleTime: 30_000,
  });
