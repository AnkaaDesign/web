import { useEffect } from "react";
import {
  IconShieldLock,
  IconDatabase,
  IconShare,
  IconLock,
  IconUserCheck,
  IconMail,
} from "@tabler/icons-react";

const LAST_UPDATED = "8 de junho de 2026";
const CONTACT_EMAIL = "kennedy.ankaa@gmail.com";

const DATA_ROWS: Array<{ type: string; purpose: string }> = [
  { type: "Nome", purpose: "Identificação da conta e do perfil do usuário" },
  { type: "Endereço de e-mail", purpose: "Autenticação e acesso à conta" },
  { type: "Número de telefone", purpose: "Cadastro e contato profissional" },
  { type: "Endereço físico", purpose: "Registro operacional, quando informado pelo usuário" },
  { type: "Identificadores de usuário e de dispositivo", purpose: "Autenticação e envio de notificações push" },
  { type: "Localização precisa", purpose: "Registro de ponto eletrônico (marcação de jornada de trabalho)" },
  { type: "Fotos", purpose: "Foto de perfil e anexos enviados pelo próprio usuário" },
  { type: "Conteúdo do usuário", purpose: "Registros e formulários inseridos pelo usuário no aplicativo" },
];

function Section({ icon: Icon, title, children }: { icon: typeof IconShieldLock; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Icon className="h-5 w-5 text-primary" stroke={1.75} />
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Política de Privacidade — Ankaa Design";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-5">
          <img src="/logo.png" alt="Ankaa Design" className="h-9 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <IconShieldLock className="h-4 w-4" stroke={1.75} />
            Privacidade
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Esta Política de Privacidade descreve como o aplicativo <strong className="text-foreground">Ankaa Design</strong> coleta,
            utiliza e protege as informações dos usuários. O Ankaa Design é uma ferramenta de uso interno e profissional destinada à
            gestão das operações da empresa.
          </p>

          <Section icon={IconDatabase} title="1. Dados que coletamos">
            <p>
              Coletamos apenas os dados necessários para o funcionamento do aplicativo. Todos os dados são vinculados à sua conta e
              utilizados exclusivamente para fins de funcionalidade do aplicativo.{" "}
              <strong className="text-foreground">Não realizamos rastreamento publicitário nem compartilhamos dados com corretores de
              dados ou redes de anúncios.</strong>
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Tipo de dado</th>
                    <th className="px-4 py-2.5 font-medium">Finalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {DATA_ROWS.map((row) => (
                    <tr key={row.type}>
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section icon={IconUserCheck} title="2. Como utilizamos os dados">
            <p>
              Os dados coletados são utilizados unicamente para: autenticar usuários, permitir o funcionamento das funcionalidades do
              aplicativo, registrar a jornada de trabalho, enviar notificações relacionadas ao serviço e garantir a segurança e a
              estabilidade do sistema.
            </p>
          </Section>

          <Section icon={IconShare} title="3. Compartilhamento de dados">
            <p>
              Não vendemos, alugamos nem compartilhamos seus dados pessoais com terceiros para fins de marketing ou publicidade. Os
              dados são armazenados em servidores próprios da empresa e acessados apenas por pessoal autorizado.
            </p>
          </Section>

          <Section icon={IconLock} title="4. Armazenamento e segurança">
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração. A
              comunicação entre o aplicativo e nossos servidores na internet é protegida por criptografia (HTTPS).
            </p>
          </Section>

          <Section icon={IconUserCheck} title="5. Seus direitos">
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais entrando em contato conosco pelo e-mail abaixo.
              Como o aplicativo é de uso corporativo interno, algumas solicitações podem estar sujeitas às políticas de retenção da
              empresa.
            </p>
          </Section>

          <Section icon={IconMail} title="6. Contato">
            <p>
              Em caso de dúvidas sobre esta Política de Privacidade, entre em contato pelo e-mail{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          © 2026 Ankaa Design. Todos os direitos reservados.
        </footer>
      </main>
    </div>
  );
}
