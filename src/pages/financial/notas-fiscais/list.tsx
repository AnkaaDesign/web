import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { NfseListContent } from "@/pages/financial/nfse/list";
import { FiscalDocumentsListContent } from "@/pages/financial/reconciliation/fiscal-documents-list";

type Segment = "emitidas" | "recebidas";

interface Props {
  /** Forces a direction regardless of sector — used by the reconciliation
   *  deeplink (`defaultSegment="recebidas"`). When omitted, the segment is
   *  chosen purely from the viewer's sector. */
  defaultSegment?: Segment;
}

/**
 * Unified "Notas Fiscais" surface. Outbound (NFS-e we emit, via Elotech) and
 * inbound (supplier NFs received via SIEG) used to be two separate pages; this
 * hosts both, but instead of a toggle the view is picked by the viewer's sector:
 *   - FINANCIAL / COMMERCIAL → Emitidas (saída)  — receivables, the NFS-e we issue.
 *   - ACCOUNTING / ADMIN     → Recebidas (entrada) — payables/tax. The recebidas
 *     list also carries the XMLs of the notas we emit (SAIDA fiscal documents),
 *     so accounting sees both directions there.
 * An explicit `defaultSegment` (from a direction-specific URL) overrides the
 * sector choice. Each segment renders the existing, self-contained content as-is.
 */
function NotasFiscaisContent({ defaultSegment }: Props) {
  const { user } = useAuth();
  const privilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // FINANCIAL/COMMERCIAL look at what we issue; ACCOUNTING/ADMIN look at the
  // received documents (which include our emitted XMLs). An explicit override
  // (reconciliation deeplink) wins.
  const sectorSegment: Segment =
    privilege === SECTOR_PRIVILEGES.FINANCIAL ||
    privilege === SECTOR_PRIVILEGES.COMMERCIAL
      ? "emitidas"
      : "recebidas";
  const segment = defaultSegment ?? sectorSegment;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {segment === "emitidas" ? <NfseListContent /> : <FiscalDocumentsListContent />}
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
