import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UnderConstructionProps {
  title: string;
}

export const UnderConstruction = ({ title }: UnderConstructionProps) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-8 py-6 flex-shrink-0 border-b border-border">
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <p className="text-muted-foreground">Esta página está em desenvolvimento.</p>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center px-8 py-6">
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center w-full min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">🚧</span>
            </div>
            <h3 className="text-lg font-medium">Em Construção</h3>
            <p className="text-sm text-muted-foreground max-w-md">Esta funcionalidade será implementada em breve. Estamos trabalhando para trazer uma experiência completa.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnderConstruction;
