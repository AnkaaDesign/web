import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Image } from "lucide-react";
import { useState } from "react";

export function LogoInput() {
  const form = useFormContext();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      form.setError("logoId", {
        type: "manual",
        message: "Apenas arquivos de imagem são permitidos",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      form.setError("logoId", {
        type: "manual",
        message: "O arquivo deve ter no máximo 5MB",
      });
      return;
    }

    try {
      setIsUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // TODO: Implement actual file upload to your storage service
      // For now, we'll just generate a mock UUID
      const mockFileId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      form.setValue("logoId", mockFileId, {
        shouldValidate: true,
        shouldDirty: true,
      });

      form.clearErrors("logoId");
    } catch (error) {
      console.error("Error uploading file:", error);
      form.setError("logoId", {
        type: "manual",
        message: "Erro ao fazer upload do arquivo",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    form.setValue("logoId", null, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setPreviewUrl(null);
  };

  const logoId = form.watch("logoId");

  return (
    <FormField
      control={form.control}
      name="logoId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Logo da Empresa</FormLabel>
          <FormControl>
            <div className="space-y-4">
              {!logoId ? (
                <div className="flex items-center space-x-2">
                  <Button type="button" variant="outline" disabled={isUploading} className="relative">
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? "Enviando..." : "Escolher arquivo"}
                    <Input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isUploading} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  {previewUrl ? (
                    <div className="relative">
                      <img src={previewUrl} alt="Logo preview" className="h-16 w-16 object-cover rounded-md border" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 bg-muted rounded-md border flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">Logo carregado</p>
                    <p className="text-xs text-muted-foreground">ID: {logoId}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleRemove}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, SVG. Tamanho máximo: 5MB.</p>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
