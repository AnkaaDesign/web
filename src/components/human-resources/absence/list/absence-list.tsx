import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Filter, Users, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { useAbsences, useAbsenceMutations } from "../../../../hooks";
import { ABSENCE_STATUS, ABSENCE_STATUS_LABELS } from "../../../../constants";
import { AbsenceCard } from "../common/absence-card";
import { AbsenceForm, AbsenceEditForm } from "../form";
import type { Absence, AbsenceGetManyParams } from "../../../../types";
import { toast } from "sonner";

interface AbsenceListProps {
  userId?: string;
  showAddButton?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  defaultStatus?: string;
  title?: string;
  description?: string;
}

export function AbsenceList({
  userId,
  showAddButton = true,
  showSearch = true,
  showFilters = true,
  defaultStatus,
  title = "Faltas",
  description = "Gerencie as faltas dos funcionários"
}: AbsenceListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus || "all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);

  const { delete: deleteAbsence } = useAbsenceMutations();

  // Build query parameters
  const queryParams: AbsenceGetManyParams = {
    include: {
      user: true,
    },
    where: {
      ...(userId && { userId }),
      ...(selectedStatus !== "all" && { status: selectedStatus as any }),
    },
    orderBy: {
      date: "desc",
    },
    searchingFor: searchTerm || undefined,
  };

  const {
    data: absencesData,
    isLoading,
    error,
    refetch
  } = useAbsences(queryParams);

  const absences = absencesData?.data || [];
  const meta = absencesData?.meta;

  const handleEdit = (absence: Absence) => {
    setEditingAbsence(absence);
  };

  const handleDelete = async (absence: Absence) => {
    if (!confirm(`Tem certeza que deseja excluir a falta de ${absence.user?.name}?`)) {
      return;
    }

    try {
      await deleteAbsence({ id: absence.id });
      toast.success("Falta excluída com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao excluir falta");
    }
  };

  const handleView = (absence: Absence) => {
    // This could navigate to a detail page or open a modal
    setEditingAbsence(absence);
  };

  const handleAddSuccess = () => {
    setIsAddOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setEditingAbsence(null);
    refetch();
  };

  const getStatusStats = () => {
    const stats = {
      total: absences.length,
      pending: absences.filter(a => a.status === ABSENCE_STATUS.PENDING_JUSTIFICATION).length,
      submitted: absences.filter(a => a.status === ABSENCE_STATUS.JUSTIFICATION_SUBMITTED).length,
      approved: absences.filter(a => a.status === ABSENCE_STATUS.APPROVED).length,
      rejected: absences.filter(a => a.status === ABSENCE_STATUS.REJECTED).length,
    };
    return stats;
  };

  const stats = getStatusStats();

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar faltas. Tente novamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            {showAddButton && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Falta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Nova Falta</DialogTitle>
                    <DialogDescription>
                      Preencha as informações da falta
                    </DialogDescription>
                  </DialogHeader>
                  <AbsenceForm
                    onSuccess={handleAddSuccess}
                    onCancel={() => setIsAddOpen(false)}
                    defaultUserId={userId}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pendentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
              <div className="text-sm text-muted-foreground">Enviadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-sm text-muted-foreground">Aprovadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <div className="text-sm text-muted-foreground">Rejeitadas</div>
            </div>
          </div>

          {/* Filters */}
          {(showSearch || showFilters) && (
            <div className="flex flex-col md:flex-row gap-4">
              {showSearch && (
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por funcionário, justificativa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              {showFilters && (
                <div className="flex gap-2">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-48">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {Object.entries(ABSENCE_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando faltas...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && absences.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma falta encontrada
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedStatus !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Não há faltas registradas no momento"}
            </p>
            {showAddButton && !userId && (
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar Primeira Falta
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Absence List */}
      {!isLoading && absences.length > 0 && (
        <div className="grid gap-4">
          {absences.map((absence) => (
            <AbsenceCard
              key={absence.id}
              absence={absence}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onView={handleView}
            />
          ))}
        </div>
      )}

      {/* Pagination Info */}
      {meta && meta.totalRecords > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground text-center">
              Mostrando {absences.length} de {meta.totalRecords} faltas
              {meta.hasNextPage && " (carregue mais para ver todas)"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingAbsence} onOpenChange={(open) => !open && setEditingAbsence(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Falta</DialogTitle>
            <DialogDescription>
              Atualize as informações da falta
            </DialogDescription>
          </DialogHeader>
          {editingAbsence && (
            <AbsenceEditForm
              absence={editingAbsence}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAbsence(null)}
              allowStatusChange={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}