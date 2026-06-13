import { useCallback, useMemo, useState } from "react";
import { IconBusinessplan, IconInfoCircle, IconReceipt2 } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { formatCurrency } from "@/utils";
import { getUsers } from "@/api-client";
import { getPositionMonthlySalary } from "@/utils/overtime-cost";
import {
  EMPLOYEE_COST_TAX_REGIME,
  EMPLOYEE_COST_TAX_REGIME_LABELS,
  DEFAULT_RAT_PCT,
  DEFAULT_FAP_FACTOR,
  DEFAULT_TERCEIROS_PCT,
  DEFAULT_DIAS_UTEIS,
  DEFAULT_DOMINGOS_FERIADOS,
  VT_DISCOUNT_CAP_PCT,
  computeEmployeeCost,
  computeVtDiscountPreview,
  formatMultiplier,
} from "@/utils/employee-cost";

const RAT_OPTIONS: ComboboxOption[] = [
  { value: "1", label: "1% — risco leve" },
  { value: "2", label: "2% — risco médio" },
  { value: "3", label: "3% — risco grave" },
];

const toNumber = (value: string | number | null, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

function EmployeeCostCalculatorContent() {
  // --- Inputs ---------------------------------------------------------------
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [taxRegime, setTaxRegime] = useState<EMPLOYEE_COST_TAX_REGIME>(EMPLOYEE_COST_TAX_REGIME.LUCRO_PRESUMIDO_REAL);
  const [ratPct, setRatPct] = useState<number>(DEFAULT_RAT_PCT);
  const [fapFactor, setFapFactor] = useState<number>(DEFAULT_FAP_FACTOR);
  const [terceirosPct, setTerceirosPct] = useState<number>(DEFAULT_TERCEIROS_PCT);
  const [he50Hours, setHe50Hours] = useState<number>(0);
  const [he100Hours, setHe100Hours] = useState<number>(0);
  const [benefitsMonthly, setBenefitsMonthly] = useState<number>(0);
  const [vtMonthlyCost, setVtMonthlyCost] = useState<number>(0);
  const [includeFgtsFineProvision, setIncludeFgtsFineProvision] = useState<boolean>(true);
  const [diasUteis, setDiasUteis] = useState<number>(DEFAULT_DIAS_UTEIS);
  const [domingosFeriados, setDomingosFeriados] = useState<number>(DEFAULT_DOMINGOS_FERIADOS);

  const isSimples = taxRegime === EMPLOYEE_COST_TAX_REGIME.SIMPLES || taxRegime === EMPLOYEE_COST_TAX_REGIME.SIMPLES_ANEXO_IV;
  const isSimplesNonAnexoIV = taxRegime === EMPLOYEE_COST_TAX_REGIME.SIMPLES;

  // --- Collaborator prefill (same selection approach as the overtime tool) ----
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getUsers({
        take: pageSize,
        skip: (page - 1) * pageSize,
        where: {
          isActive: true,
          ...(searchTerm
            ? {
                OR: [
                  { name: { contains: searchTerm, mode: "insensitive" } },
                  { email: { contains: searchTerm, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { name: "asc" },
        include: { position: true },
      });

      const users = response.data ?? [];
      const total = response.meta?.totalRecords ?? 0;
      const hasMore = page * pageSize < total;

      return {
        data: users.map((u) => ({
          value: u.id,
          label: u.name,
          description: u.position?.name ?? "Sem cargo",
        })) as ComboboxOption[],
        hasMore,
        total,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Erro ao buscar colaboradores:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  const handleUserSelected = useCallback(async (value: string | string[] | null | undefined) => {
    const userId = Array.isArray(value) ? value[0] : value;
    setSelectedUserId(userId ?? null);
    if (!userId) return;

    try {
      const response = await getUsers({
        where: { id: { in: [userId] } },
        include: {
          position: {
            include: {
              monetaryValues: true,
              remunerations: true,
            },
          },
        },
        take: 1,
      });
      const user = response.data?.[0];
      const salary = getPositionMonthlySalary(user?.position ?? null);
      if (salary != null) {
        setBaseSalary(salary);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Erro ao carregar salário do colaborador:", error);
      }
    }
  }, []);

  // --- Computation (pure, §6) -------------------------------------------------
  const breakdown = useMemo(
    () =>
      computeEmployeeCost({
        baseSalary,
        taxRegime,
        ratPct,
        fapFactor,
        terceirosPct,
        he50Hours,
        he100Hours,
        benefitsMonthly,
        includeFgtsFineProvision,
        diasUteis,
        domingosFeriados,
      }),
    [baseSalary, taxRegime, ratPct, fapFactor, terceirosPct, he50Hours, he100Hours, benefitsMonthly, includeFgtsFineProvision, diasUteis, domingosFeriados],
  );

  const vtDiscount = useMemo(() => computeVtDiscountPreview(baseSalary, vtMonthlyCost), [baseSalary, vtMonthlyCost]);

  const hasSalary = baseSalary > 0;

  // Breakdown rows (label / detail / monthly value)
  const rows: Array<{ label: string; detail?: string; value: number; emphasize?: boolean }> = [
    { label: "Remuneração (salário base)", value: baseSalary },
    { label: "Horas extras 50%", detail: `${he50Hours}h × ${formatCurrency(breakdown.horaNormal * 1.5)}`, value: breakdown.he50 },
    { label: "Horas extras 100%", detail: `${he100Hours}h × ${formatCurrency(breakdown.horaNormal * 2)}`, value: breakdown.he100 },
    { label: "Reflexo DSR", detail: `(HE50 + HE100) ÷ ${diasUteis} × ${domingosFeriados}`, value: breakdown.reflexoDSR },
    { label: "Provisão 13º salário", detail: "remuneração ÷ 12", value: breakdown.provisao13 },
    { label: "Provisão férias + 1/3", detail: "remuneração ÷ 12 × 4/3", value: breakdown.provisaoFerias },
    { label: "FGTS (8%)", detail: "8% × base de incidência", value: breakdown.fgts },
    ...(includeFgtsFineProvision ? [{ label: "Provisão multa FGTS (40%)", detail: "40% × FGTS", value: breakdown.provisaoMultaFgts }] : []),
    ...(!isSimplesNonAnexoIV
      ? [
          { label: "INSS patronal (20%)", detail: "20% × base de incidência", value: breakdown.inssPatronal20 },
          { label: `INSS — RAT × FAP (${(ratPct * fapFactor).toLocaleString("pt-BR")}%)`, detail: `${ratPct}% × ${fapFactor.toLocaleString("pt-BR")}`, value: breakdown.inssRatFap },
        ]
      : []),
    ...(taxRegime === EMPLOYEE_COST_TAX_REGIME.LUCRO_PRESUMIDO_REAL
      ? [{ label: `INSS — Terceiros (${terceirosPct.toLocaleString("pt-BR")}%)`, detail: "Sistema S / salário-educação", value: breakdown.inssTerceiros }]
      : []),
    { label: "Benefícios", detail: "custo mensal do empregador", value: breakdown.beneficios },
  ];

  // --- Render -------------------------------------------------------------------
  return (
    <TooltipProvider>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Custo de Funcionário"
            icon={IconBusinessplan}
            favoritePage={FAVORITE_PAGES.FERRAMENTAS_CUSTO_DE_FUNCIONARIO}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Ferramentas", href: routes.tools.root },
              { label: "Custo de Funcionário" },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            {/* Parameters card */}
            <Card className="lg:col-span-2 flex flex-col w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Parâmetros</CardTitle>
                <CardDescription>
                  Informe o salário diretamente ou selecione um colaborador para preencher com o salário vigente do cargo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="space-y-2">
                  <Label>Colaborador (opcional)</Label>
                  <Combobox
                    async
                    queryKey={["employee-cost", "user-search"]}
                    queryFn={queryUsers}
                    minSearchLength={0}
                    pageSize={50}
                    debounceMs={300}
                    value={selectedUserId ?? undefined}
                    onValueChange={(v) => void handleUserSelected(v)}
                    placeholder="Buscar colaborador..."
                    emptyText="Nenhum colaborador encontrado"
                    searchable
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ec-salary">Salário base mensal</Label>
                  <Input id="ec-salary" type="currency" value={baseSalary || null} onChange={(v) => setBaseSalary(toNumber(v))} placeholder="R$ 0,00" />
                </div>

                <div className="space-y-2">
                  <Label>Regime tributário</Label>
                  <RadioGroup
                    value={taxRegime}
                    onValueChange={(v) => setTaxRegime(v as EMPLOYEE_COST_TAX_REGIME)}
                    className="gap-2"
                  >
                    {Object.values(EMPLOYEE_COST_TAX_REGIME).map((regime) => (
                      <div key={regime} className="group flex items-center gap-2">
                        <RadioGroupItem value={regime} id={`ec-regime-${regime}`} />
                        <Label htmlFor={`ec-regime-${regime}`} className="font-normal cursor-pointer">
                          {EMPLOYEE_COST_TAX_REGIME_LABELS[regime]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {isSimplesNonAnexoIV && (
                    <p className="text-xs text-muted-foreground">No Simples (exceto Anexo IV) a CPP está incluída no DAS — INSS patronal zerado.</p>
                  )}
                </div>

                {!isSimplesNonAnexoIV && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>RAT</Label>
                      <Combobox
                        options={RAT_OPTIONS}
                        value={String(ratPct)}
                        onValueChange={(v) => {
                          const next = Array.isArray(v) ? v[0] : v;
                          if (next) setRatPct(toNumber(next, DEFAULT_RAT_PCT));
                        }}
                        searchable={false}
                        clearable={false}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ec-fap">FAP (0,5 – 2,0)</Label>
                      <Input
                        id="ec-fap"
                        type="decimal"
                        value={fapFactor}
                        onChange={(v) => {
                          const parsed = toNumber(v, DEFAULT_FAP_FACTOR);
                          setFapFactor(Math.min(2, Math.max(0.5, parsed)));
                        }}
                        placeholder="1,0"
                      />
                    </div>
                  </div>
                )}

                {!isSimples && (
                  <div className="space-y-2">
                    <Label htmlFor="ec-terceiros">Terceiros (%)</Label>
                    <Input
                      id="ec-terceiros"
                      type="percentage"
                      value={terceirosPct}
                      onChange={(v) => setTerceirosPct(toNumber(v, DEFAULT_TERCEIROS_PCT))}
                      placeholder="5,8%"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ec-he50">HE 50% (h/mês)</Label>
                    <Input id="ec-he50" type="decimal" value={he50Hours} onChange={(v) => setHe50Hours(Math.max(0, toNumber(v)))} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ec-he100">HE 100% (h/mês)</Label>
                    <Input id="ec-he100" type="decimal" value={he100Hours} onChange={(v) => setHe100Hours(Math.max(0, toNumber(v)))} placeholder="0" />
                  </div>
                </div>

                {(he50Hours > 0 || he100Hours > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ec-dias-uteis">Dias úteis (DSR)</Label>
                      <Input id="ec-dias-uteis" type="natural" value={diasUteis} onChange={(v) => setDiasUteis(Math.max(1, toNumber(v, DEFAULT_DIAS_UTEIS)))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ec-dsr-dias">Domingos + feriados</Label>
                      <Input
                        id="ec-dsr-dias"
                        type="natural"
                        value={domingosFeriados}
                        onChange={(v) => setDomingosFeriados(Math.max(0, toNumber(v, DEFAULT_DOMINGOS_FERIADOS)))}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="ec-benefits">Benefícios (custo mensal)</Label>
                  <Input id="ec-benefits" type="currency" value={benefitsMonthly || null} onChange={(v) => setBenefitsMonthly(toNumber(v))} placeholder="R$ 0,00" />
                  <p className="text-xs text-muted-foreground">Some VT, VR/VA, plano de saúde e demais benefícios pagos pela empresa.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ec-vt">Custo mensal de VT (para prévia de desconto)</Label>
                  <Input id="ec-vt" type="currency" value={vtMonthlyCost || null} onChange={(v) => setVtMonthlyCost(toNumber(v))} placeholder="R$ 0,00" />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="ec-fgts-fine" className="cursor-pointer">
                      Provisionar multa FGTS (40%)
                    </Label>
                    <p className="text-xs text-muted-foreground">Reserva mensal para eventual dispensa sem justa causa.</p>
                  </div>
                  <Switch id="ec-fgts-fine" checked={includeFgtsFineProvision} onCheckedChange={setIncludeFgtsFineProvision} />
                </div>
              </CardContent>
            </Card>

            {/* Results card */}
            <Card className="lg:col-span-3 flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IconReceipt2 className="h-5 w-5" stroke={1.5} />
                    Composição do custo
                  </CardTitle>
                  <CardDescription>Detalhamento mensal do custo do empregador por verba.</CardDescription>
                </div>
                {hasSalary && (
                  <Badge variant="default" className="text-sm whitespace-nowrap">
                    {formatMultiplier(breakdown.multiplicador)}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasSalary ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                    <IconBusinessplan className="h-12 w-12 opacity-30" stroke={1.5} />
                    <p className="text-sm">Informe o salário base (ou selecione um colaborador) para calcular o custo.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Verba</TableHead>
                            <TableHead className="text-right">Valor mensal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.label}>
                              <TableCell>
                                <div className="font-medium">{row.label}</div>
                                {row.detail && <div className="text-xs text-muted-foreground">{row.detail}</div>}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(row.value)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableCell className="font-semibold">Remuneração total (salário + HE + DSR)</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(breakdown.remuneracao)}</TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableCell className="font-semibold">INSS patronal total</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(breakdown.inssPatronalTotal)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Totals */}
                    <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Custo mensal total</p>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(breakdown.custoMensal)}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs text-muted-foreground">Custo anual (×12)</p>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(breakdown.custoAnual)}</p>
                      </div>
                    </div>

                    {/* VT discount preview */}
                    {vtMonthlyCost > 0 && (
                      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <IconInfoCircle className="h-4 w-4 flex-shrink-0" stroke={1.5} />
                        <span>
                          Prévia de desconto de VT do colaborador: <strong className="text-foreground">{formatCurrency(vtDiscount)}</strong>{" "}
                          (mínimo entre {VT_DISCOUNT_CAP_PCT}% do salário = {formatCurrency((VT_DISCOUNT_CAP_PCT / 100) * baseSalary)} e o custo do VT ={" "}
                          {formatCurrency(vtMonthlyCost)}). Custo líquido de VT para a empresa: {formatCurrency(Math.max(0, vtMonthlyCost - vtDiscount))}.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <IconInfoCircle className="h-4 w-4 flex-shrink-0" stroke={1.5} />
                      <span>
                        Simulação estimativa (divisor 220h; provisões de 13º e férias+1/3 sobre a remuneração; FGTS e INSS sobre remuneração + provisões).
                        Não substitui o cálculo da folha.
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function EmployeeCostCalculatorPage() {
  // Track page access
  usePageTracker({
    title: "Custo de Funcionário",
    icon: "businessplan",
  });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.BASIC,
        SECTOR_PRIVILEGES.PRODUCTION,
        SECTOR_PRIVILEGES.MAINTENANCE,
        SECTOR_PRIVILEGES.WAREHOUSE,
        SECTOR_PRIVILEGES.DESIGNER,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.LOGISTIC,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.HUMAN_RESOURCES,
        SECTOR_PRIVILEGES.EXTERNAL,
        SECTOR_PRIVILEGES.PLOTTING,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <EmployeeCostCalculatorContent />
    </PrivilegeRoute>
  );
}

export default EmployeeCostCalculatorPage;
