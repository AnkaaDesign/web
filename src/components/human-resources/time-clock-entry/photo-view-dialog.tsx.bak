import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconCamera, IconDownload, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useSecullumIntegration } from "@/hooks/useSecullumIntegration";

interface PhotoViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  fonteDadosId: number;
}

export function PhotoViewDialog({ isOpen, onClose, userId, fonteDadosId }: PhotoViewDialogProps) {
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchPhoto } = useSecullumIntegration();

  useEffect(() => {
    if (isOpen && userId && fonteDadosId) {
      loadPhoto();
    }
  }, [isOpen, userId, fonteDadosId]);

  const loadPhoto = async () => {
    setLoading(true);
    setError(null);
    try {
      const photo = await fetchPhoto(userId, fonteDadosId);
      if (photo) {
        setPhotoData(photo);
      } else {
        setError("Foto não encontrada");
      }
    } catch (err) {
      setError("Erro ao carregar a foto");
      console.error("Error loading photo:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (photoData) {
      const link = document.createElement("a");
      link.href = photoData;
      link.download = `ponto_${userId}_${fonteDadosId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Foto do Registro de Ponto</DialogTitle>
          <DialogDescription>Foto capturada no momento do registro</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center h-[400px]">
              <IconLoader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
              <IconCamera className="h-12 w-12 mb-2 text-gray-300" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={loadPhoto} className="mt-4">
                Tentar novamente
              </Button>
            </div>
          )}

          {photoData && !loading && !error && (
            <>
              <div className="w-full bg-gray-100 rounded-lg overflow-hidden">
                <img src={photoData} alt="Foto do registro de ponto" className="w-full h-auto max-h-[400px] object-contain" />
              </div>

              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-gray-500">ID: {fonteDadosId}</p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  Baixar foto
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
