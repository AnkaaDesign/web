import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconMapPin, IconClock, IconNavigation } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LocationData } from "./types";

interface LocationMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationData;
}

export function LocationMapDialog({ isOpen, onClose, location }: LocationMapDialogProps) {
  const mapUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d${location.Longitude}!3d${location.Latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjPCsDE3JzEyLjEiUyA1McKwMDQnMjUuMSJX!5e0!3m2!1spt-BR!2sbr!4v1234567890`;

  const openInMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${location.Latitude},${location.Longitude}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Localização do Registro</DialogTitle>
          <DialogDescription>Localização onde o ponto foi registrado</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Map */}
          <div className="w-full h-[300px] bg-gray-100 rounded-lg overflow-hidden">
            <iframe title="Localização" src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>

          {/* Location details */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <IconMapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Endereço</p>
                <p className="text-sm text-gray-600">{location.Endereco !== "null" ? location.Endereco : "Endereço não disponível"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <IconClock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Data e Hora</p>
                <p className="text-sm text-gray-600">{format(new Date(location.DataHora), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <IconNavigation className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Coordenadas</p>
                <p className="text-sm text-gray-600">
                  Latitude: {location.Latitude.toFixed(6)}, Longitude: {location.Longitude.toFixed(6)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Precisão: {location.Precisao.toFixed(1)} metros</p>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end">
            <button onClick={openInMaps} className="text-sm text-blue-600 hover:text-blue-700 underline">
              Abrir no Google Maps
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
