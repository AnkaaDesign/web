import { useState, useCallback } from "react";
import { secullumService } from "../../api-client";

interface Configuration {
  Chave: string;
  Valor: string;
}

interface Justification {
  Id: number;
  NomeAbreviado: string;
  NomeCompleto?: string | null;
  ValorDia?: any;
  Ajuste: boolean;
  Abono2: boolean;
  Abono3: boolean;
  Abono4: boolean;
  UsarJustificativaParaContagemDeFerias: boolean;
}

interface TimeEntry {
  Id: number;
  FuncionarioId: number;
  Data: string;
  DataExibicao: string;
  TipoDoDia: number;
  Entrada1?: string | null;
  Saida1?: string | null;
  Entrada2?: string | null;
  Saida2?: string | null;
  Entrada3?: string | null;
  Saida3?: string | null;
  Entrada4?: string | null;
  Saida4?: string | null;
  Entrada5?: string | null;
  Saida5?: string | null;
  Ajuste?: string | null;
  Abono2?: string | null;
  Abono3?: string | null;
  Abono4?: string | null;
  Observacoes?: string | null;
  AlmocoLivre: boolean;
  Compensado: boolean;
  Neutro: boolean;
  Folga: boolean;
  NBanco: boolean;
  Refeicao: boolean;
  FonteDadosIdEntrada1?: number | null;
  FonteDadosIdSaida1?: number | null;
  FonteDadosIdEntrada2?: number | null;
  FonteDadosIdSaida2?: number | null;
  FonteDadosIdEntrada3?: number | null;
  FonteDadosIdSaida3?: number | null;
  FonteDadosIdEntrada4?: number | null;
  FonteDadosIdSaida4?: number | null;
  FonteDadosIdEntrada5?: number | null;
  FonteDadosIdSaida5?: number | null;
  FonteDadosEntrada1?: any;
  FonteDadosSaida1?: any;
  FonteDadosEntrada2?: any;
  FonteDadosSaida2?: any;
  FonteDadosEntrada3?: any;
  FonteDadosSaida3?: any;
  FonteDadosEntrada4?: any;
  FonteDadosSaida4?: any;
  FonteDadosEntrada5?: any;
  FonteDadosSaida5?: any;
  [key: string]: any;
}

export function useSecullumIntegration() {
  const [configuration, setConfiguration] = useState<Configuration[] | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[] | null>(null);
  const [justifications, setJustifications] = useState<Justification[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguration = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await secullumService.getConfiguration();
      setConfiguration(response.data.data);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar configuração");
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching configuration:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTimeEntries = useCallback(async (userId: number, startDate: string, endDate: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await secullumService.getTimeEntries({ userId, startDate, endDate });
      setTimeEntries(response.data.data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar registros de ponto");
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching time entries:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchJustifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await secullumService.getJustifications();
      setJustifications(response.data.data);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar justificativas");
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching justifications:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPhoto = useCallback(async (userId: number, fonteDadosId: number) => {
    try {
      const response = await secullumService.getTimeEntryPhoto(userId, fonteDadosId);
      return response.data.data?.FotoBatida || null;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching photo:", err);
      }
      return null;
    }
  }, []);

  const saveTimeEntries = useCallback(async (entries: TimeEntry[]) => {
    setIsLoading(true);
    setError(null);
    try {
      // This would be implemented on the backend to save the modified entries
      // For now, we"ll just simulate the save
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setTimeEntries(entries);
      return true;
    } catch (err: any) {
      setError(err.message || "Erro ao salvar registros");
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error saving time entries:", err);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    configuration,
    timeEntries,
    justifications,
    isLoading,
    error,
    fetchConfiguration,
    fetchTimeEntries,
    fetchJustifications,
    fetchPhoto,
    saveTimeEntries,
  };
}
