import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RepresentativeForm } from '@/components/representatives';
import { PageHeader } from '@/components/ui/page-header';
import { IconUsers, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { representativeService } from '@/services/representativeService';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { routes } from '@/constants';
import type { RepresentativeUpdateFormData } from '@/types/representative';

export default function EditRepresentativePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Fetch representative data
  const { data: representative, isLoading, error } = useQuery({
    queryKey: ['representative', id],
    queryFn: () => representativeService.getById(id!),
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: RepresentativeUpdateFormData) =>
      representativeService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['representatives'] });
      queryClient.invalidateQueries({ queryKey: ['representative', id] });
      toast({
        title: 'Sucesso',
        description: 'Representante atualizado com sucesso',
      });
      navigate(routes.representatives.root);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar representante',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: RepresentativeUpdateFormData) => {
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    navigate(routes.representatives.root);
  };

  const actions = [
    {
      key: 'cancel',
      label: 'Cancelar',
      onClick: handleCancel,
      variant: 'outline' as const,
      disabled: updateMutation.isPending,
    },
    {
      key: 'submit',
      label: 'Salvar',
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById('representative-form-submit')?.click(),
      variant: 'default' as const,
      disabled: updateMutation.isPending || !formState.isValid || !formState.isDirty,
      loading: updateMutation.isPending,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !representative) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || 'Representante não encontrado'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          title="Editar Representante"
          icon={IconUsers}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Administração', href: routes.administration.root },
            { label: 'Clientes', href: routes.administration.customers.root },
            { label: 'Representantes', href: routes.representatives.root },
            { label: representative.name, href: routes.representatives.details(id!) },
            { label: 'Editar' },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <RepresentativeForm
          mode="edit"
          initialData={representative}
          initialCustomer={representative?.customer}
          onSubmit={handleSubmit}
          isSubmitting={updateMutation.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
}