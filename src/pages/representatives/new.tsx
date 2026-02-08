import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepresentativeForm } from '@/components/administration/customer/representative';
import { PageHeader } from '@/components/ui/page-header';
import { IconUsers, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { representativeService } from '@/services/representativeService';
import { useToast } from '@/hooks/common/use-toast';
import { routes } from '@/constants';
import type { RepresentativeCreateFormData } from '@/types/representative';

export default function NewRepresentativePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const createMutation = useMutation({
    mutationFn: (data: RepresentativeCreateFormData) => representativeService.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['representatives'] });
      toast({
        title: 'Sucesso',
        description: 'Representante cadastrado com sucesso',
      });
      navigate(routes.representatives.edit(data.id));
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cadastrar representante',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: RepresentativeCreateFormData) => {
    createMutation.mutate(data);
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
      disabled: createMutation.isPending,
    },
    {
      key: 'submit',
      label: 'Cadastrar',
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById('representative-form-submit')?.click(),
      variant: 'default' as const,
      disabled: createMutation.isPending || !formState.isValid,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          title="Cadastrar Representante"
          icon={IconUsers}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Administração', href: routes.administration.root },
            { label: 'Clientes', href: routes.administration.customers.root },
            { label: 'Representantes', href: routes.representatives.root },
            { label: 'Cadastrar' },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <RepresentativeForm
          mode="create"
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
}