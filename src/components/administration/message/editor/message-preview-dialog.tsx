import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { MessageFormData } from "./types";

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MessageFormData;
}

export const MessagePreviewDialog = ({ open, onOpenChange, data }: MessagePreviewDialogProps) => {
  const renderBlock = (block: any) => {
    switch (block.type) {
      case 'heading1':
        return <h1 className="text-3xl font-bold">{block.content}</h1>;
      case 'heading2':
        return <h2 className="text-2xl font-semibold">{block.content}</h2>;
      case 'heading3':
        return <h3 className="text-xl font-medium">{block.content}</h3>;
      case 'paragraph':
        return <p className="text-base">{block.content}</p>;
      case 'quote':
        return (
          <blockquote className="border-l-4 border-primary pl-4 italic text-lg">
            {block.content}
          </blockquote>
        );
      case 'image':
        return (
          <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            <div>
              <img
                src={block.url}
                alt={block.alt || ''}
                className="max-w-full h-auto rounded-lg"
                style={{ maxHeight: '400px' }}
              />
              {block.caption && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {block.caption}
                </p>
              )}
            </div>
          </div>
        );
      case 'button':
        return (
          <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            <Button variant={block.variant || 'default'}>
              {block.text}
            </Button>
          </div>
        );
      case 'divider':
        return <Separator />;
      case 'list':
        return block.ordered ? (
          <ol className="list-decimal list-inside space-y-1">
            {block.items.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {block.items.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = () => {
    const variants = {
      low: 'secondary' as const,
      normal: 'default' as const,
      high: 'destructive' as const,
    };
    const labels = {
      low: 'Baixa',
      normal: 'Normal',
      high: 'Alta',
    };
    return (
      <Badge variant={variants[data.priority]}>
        {labels[data.priority]}
      </Badge>
    );
  };

  const getTargetingText = () => {
    switch (data.targeting.type) {
      case 'all':
        return 'Todos os usuários';
      case 'specific':
        return `${data.targeting.userIds?.length || 0} usuários específicos`;
      case 'roles':
        return `${data.targeting.roleIds?.length || 0} cargos selecionados`;
      default:
        return 'Não definido';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview da Mensagem</DialogTitle>
        </DialogHeader>

        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold">{data.title}</h2>
                {getPriorityBadge()}
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <div>Público: {getTargetingText()}</div>
                {data.scheduling.startDate && (
                  <div>
                    Início: {data.scheduling.startDate.toLocaleDateString('pt-BR')}
                  </div>
                )}
                {data.scheduling.endDate && (
                  <div>
                    Término: {data.scheduling.endDate.toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Content Blocks */}
            <div className="space-y-4">
              {data.blocks.map((block) => (
                <div key={block.id}>{renderBlock(block)}</div>
              ))}
            </div>

            {data.blocks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum conteúdo adicionado ainda
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
