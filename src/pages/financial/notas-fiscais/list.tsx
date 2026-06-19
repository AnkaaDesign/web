import { useMemo, useState } from "react";
import { IconFileInvoice, IconFileImport } from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SECTOR_PRIVILEGES } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { NfseListContent } from "@/pages/financial/nfse/list";
import { FiscalDocumentsListContent } from "@/pages/financial/reconciliation/fiscal-documents-list";

type Segment = "emitidas" | "recebidas";

interface Props {
  /** Initial segment when reached from a direction-specific URL. Falls back to
   *  the sector default (FINANCIAL/COMMERCIAL/ADMIN → emitidas; ACCOUNTING →
   *  recebidas) when omitted. */
  defaultSegment?: Segment;
}

/**
 * Unified "Notas Fiscais" surface. Outbound (NFS-e we emit, via Elotech) and
 * inbound (supplier NFs received via SIEG) used to be two separate pages; this
 * hosts both under one direction toggle with a sector-aware default:
 *   - Emitidas (saída)  — what FINANCIAL/COMMERCIAL care about (receivables).
 *   - Recebidas (entrada) — what ACCOUNTING cares about (payables/tax).
 * Each segment renders the existing, self-contained content as-is; only the
 * segments the user can actually access are offered (COMMERCIAL gets emitidas
 * only — the inbound fiscal-documents API excludes it).
 */
function NotasFiscaisContent({ defaultSegment }: Props) {
  const { user } = useAuth();
  const privilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  const canSeeEmitidas =
    privilege === SECTOR_PRIVILEGES.ADMIN ||
    privilege === SECTOR_PRIVILEGES.FINANCIAL ||
    privilege === SECTOR_PRIVILEGES.COMMERCIAL ||
    privilege === SECTOR_PRIVILEGES.ACCOUNTING;
  const canSeeRecebidas =
    privilege === SECTOR_PRIVILEGES.ADMIN ||
    privilege === SECTOR_PRIVILEGES.FINANCIAL ||
    privilege === SECTOR_PRIVILEGES.ACCOUNTING;

  const sectorDefault: Segment =
    privilege === SECTOR_PRIVILEGES.ACCOUNTING ? "recebidas" : "emitidas";

  // The default segment, recomputed from privilege (which may load async) and
  // clamped to what the user can access. Until the user explicitly picks a tab,
  // this drives the view — so a late-arriving privilege still lands correctly.
  const fallback: Segment = useMemo(() => {
    const want = defaultSegment ?? sectorDefault;
    if (want === "recebidas" && !canSeeRecebidas) return "emitidas";
    if (want === "emitidas" && !canSeeEmitidas) return "recebidas";
    return want;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSegment, privilege]);

  const [chosen, setChosen] = useState<Segment | null>(null);
  const segment = chosen ?? fallback;
  const setSegment = setChosen;
  const showToggle = canSeeEmitidas && canSeeRecebidas;

  return (
    <div className="h-full flex flex-col">
      {showToggle && (
        <div className="px-4 pt-4">
          <ToggleGroup
            type="single"
            value={segment}
            onValueChange={(v) => v && setSegment(v as Segment)}
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="emitidas" className="gap-1.5 px-3">
              <IconFileInvoice className="h-4 w-4" /> Emitidas
            </ToggleGroupItem>
            <ToggleGroupItem value="recebidas" className="gap-1.5 px-3">
              <IconFileImport className="h-4 w-4" /> Recebidas
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {segment === "emitidas" && canSeeEmitidas ? (
          <NfseListContent />
        ) : (
          <FiscalDocumentsListContent />
        )}
      </div>
    </div>
  );
}

export function NotasFiscaisPage({ defaultSegment }: Props) {
  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <NotasFiscaisContent defaultSegment={defaultSegment} />
    </PrivilegeRoute>
  );
}

export default NotasFiscaisPage;
