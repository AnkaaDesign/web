import type { PaymentConfig } from "@/types/task-quote";

/**
 * Client-side projection of the installments (parcelas) that the API will
 * generate when billing is approved. Mirrors
 * `invoice-generation.service.ts → computeInstallments` so the boleto preview
 * shows the same parcelas/vencimentos that will actually be created.
 *
 * NOTE: the API rolls weekends AND national holidays to the next business day
 * using a holiday calendar that isn't available on the client. Here we only
 * roll weekends, so previewed dates can differ by a day or two when a due date
 * lands on a holiday — they are clearly labelled "previsto" in the UI.
 */
export interface ProjectedInstallment {
  number: number;
  dueDate: Date;
  amount: number;
}

const MS_DAY = 24 * 60 * 60 * 1000;

const atNoonUTC = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));

const addDays = (base: Date, days: number): Date => new Date(base.getTime() + days * MS_DAY);

/** Roll Saturday/Sunday forward to Monday (holiday calendar unavailable client-side). */
const nextWeekday = (d: Date): Date => {
  const day = d.getUTCDay();
  if (day === 6) return addDays(d, 2);
  if (day === 0) return addDays(d, 1);
  return d;
};

/**
 * Map the legacy `paymentCondition` string enum to a structured config, matching
 * `quote-text-generators.ts` semantics (entry in 5 days, others every 20 days).
 */
function conditionToConfig(condition: string): PaymentConfig | null {
  if (!condition || condition === "CUSTOM") return null;
  const cashDaysMap: Record<string, number> = {
    CASH_5: 5,
    CASH_10: 10,
    CASH_20: 20,
    CASH_40: 40,
  };
  if (condition in cashDaysMap) {
    return { type: "CASH", cashDays: cashDaysMap[condition] };
  }
  const countMap: Record<string, number> = {
    INSTALLMENTS_2: 2,
    INSTALLMENTS_3: 3,
    INSTALLMENTS_4: 4,
    INSTALLMENTS_5: 5,
    INSTALLMENTS_6: 6,
    INSTALLMENTS_7: 7,
  };
  const installmentCount = countMap[condition];
  if (!installmentCount) return null;
  return { type: "INSTALLMENTS", installmentCount, installmentStep: 20, entryDays: 5 };
}

export function projectInstallments(
  total: number,
  paymentConfig?: PaymentConfig | null,
  paymentCondition?: string | null,
  anchor: Date = new Date(),
): ProjectedInstallment[] {
  if (!Number.isFinite(total) || total <= 0) return [];

  const config = paymentConfig?.type
    ? paymentConfig
    : paymentCondition
      ? conditionToConfig(paymentCondition)
      : null;

  // Without a structured config we cannot project a schedule (e.g. free-text terms).
  if (!config) return [{ number: 1, dueDate: nextWeekday(atNoonUTC(anchor)), amount: total }];

  const baseDate = atNoonUTC(anchor);
  const now = new Date();
  // Floor: today + 3 business days, mirroring the API's minDueDate.
  const minDueDate = nextWeekday(atNoonUTC(addDays(now, 3)));
  const ensureMin = (d: Date): Date => (d < minDueDate ? minDueDate : d);

  const resolveFirstDue = (): Date => {
    if (config.specificDate) {
      const [y, m, d] = config.specificDate.split("-").map(Number);
      return ensureMin(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
    }
    if (config.type === "CASH") return ensureMin(addDays(baseDate, config.cashDays ?? 5));
    return ensureMin(addDays(baseDate, config.entryDays ?? 5));
  };

  if (config.type === "CASH") {
    return [{ number: 1, dueDate: nextWeekday(resolveFirstDue()), amount: total }];
  }

  // INSTALLMENTS
  const count = config.installmentCount ?? 2;
  const step = config.installmentStep ?? 20;
  const entryDays = config.entryDays ?? 5;
  const firstDue = resolveFirstDue();
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);

  return Array.from({ length: count }, (_, i) => {
    const rawDue =
      i === 0
        ? firstDue
        : config.specificDate
          ? addDays(firstDue, step * i)
          : ensureMin(addDays(baseDate, entryDays + step * i));
    const dueDate = nextWeekday(rawDue);
    const isLast = i === count - 1;
    const amount = isLast ? (totalCents - baseCents * (count - 1)) / 100 : baseCents / 100;
    return { number: i + 1, dueDate, amount };
  });
}
