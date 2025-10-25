import { usePageTracker } from "@/hooks/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconUser, IconMail, IconPhone, IconBriefcase, IconMapPin, IconCalendar } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "../../constants";

export function MyProfilePage() {
  // Track page access
  usePageTracker({
    title: "Meu Perfil",
    icon: "user",
  });

  const { user } = useAuth();

  if (!user) {
    return null;
  }

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Page Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Meu Perfil"
          icon={IconUser}
          favoritePage={FAVORITE_PAGES.MY_PROFILE}
          breadcrumbs={[
            { label: "Pessoal", path: routes.personal.root },
            { label: "Meu Perfil", path: routes.personal.myProfile },
          ]}
        />
      </div>

      {/* Profile Content - Two Column Layout */}
      <div className="flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Section - Avatar */}
          <div className="lg:col-span-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-4">
                  {/* Avatar */}
                  <Avatar className="h-32 w-32 border-4 border-muted">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-3xl font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* User Name */}
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold">{user.name}</h2>
                    {user.position && (
                      <p className="text-sm text-muted-foreground">{user.position}</p>
                    )}
                  </div>

                  {/* Role Badge */}
                  {user.role && (
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {user.role}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Section - Information */}
          <div className="lg:col-span-8">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Informações Pessoais</h3>

                <div className="space-y-4">
                  {/* Email */}
                  {user.email && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <IconMail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {user.phone && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <IconPhone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p className="font-medium">{user.phone}</p>
                      </div>
                    </div>
                  )}

                  {/* Position */}
                  {user.position && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <IconBriefcase className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Cargo</p>
                        <p className="font-medium">{user.position}</p>
                      </div>
                    </div>
                  )}

                  {/* Sector */}
                  {user.sector && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <IconMapPin className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Setor</p>
                        <p className="font-medium">{user.sector}</p>
                      </div>
                    </div>
                  )}

                  {/* Created At */}
                  {user.createdAt && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <IconCalendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Membro desde</p>
                        <p className="font-medium">
                          {new Date(user.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
