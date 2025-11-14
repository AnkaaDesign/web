import { useState, useRef } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadPhoto, deletePhoto } from "@/api-client";
import type { User } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AvatarUploadProps {
  user?: User;
  disabled?: boolean;
  onAvatarChange?: (avatarId: string | null) => void;
}

export function AvatarUpload({ user, disabled, onAvatarChange }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar?.url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
      toast.error("Formato inválido. Use JPG, PNG, GIF ou WEBP.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5MB");
      return;
    }

    try {
      setIsUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload photo via profile API
      const response = await uploadPhoto(file);

      if (response.success && response.data.avatarId) {
        toast.success("Foto atualizada!");
        onAvatarChange?.(response.data.avatarId);
        if (response.data.avatar) {
          setAvatarUrl(response.data.avatar.url || null);
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao fazer upload");
      // Restore previous avatar on error
      setAvatarUrl(user?.avatar?.url || null);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      setIsUploading(true);
      const response = await deletePhoto();

      if (response.success) {
        toast.success("Foto removida!");
        setAvatarUrl(null);
        onAvatarChange?.(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao remover foto");
    } finally {
      setIsUploading(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar className="w-32 h-32">
          <AvatarImage src={avatarUrl || undefined} alt={user?.name} />
          <AvatarFallback className="text-2xl">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="w-4 h-4 mr-2" />
          {avatarUrl ? "Alterar Foto" : "Adicionar Foto"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
        />

        {avatarUrl && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remover Foto
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG, GIF, WEBP • Máximo 5MB
      </p>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Foto de Perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a foto de perfil? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAvatar}
              disabled={isUploading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUploading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
