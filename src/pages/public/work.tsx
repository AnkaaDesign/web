import { useEffect } from "react";
import { IconBrandWhatsapp } from "@tabler/icons-react";

import { BRAND_ASSETS } from "@/config/assets";
import { COMPANY_INFO, whatsappLinkFor } from "@/config/company";

/**
 * Página pública do trabalho — o destino do QR das etiquetas coladas nos baús
 * (`/trabalhos/{task.id}`, ver components/production/task/labels).
 *
 * POR ENQUANTO É SÓ UMA BRINCADEIRA: quem escaneia um baú na estrada cai aqui
 * e recebe um "curioso?" com a marca. A página de verdade (fotos e história do
 * trabalho) vem depois; o id já chega na URL e é ignorado de propósito.
 *
 * Pública e pensada para o CELULAR — é o aparelho que lê o QR. Por isso:
 *   - fica fora do login (declarada junto das rotas públicas no App);
 *   - `/trabalhos` está na lista do MobileUsageGuard, senão o celular seria
 *     mandado para o /install antes de ver a página;
 *   - cores FIXAS da marca, e não os tokens do tema: quem abre não é usuário do
 *     sistema e o tema escuro guardado no navegador não pode mudar a página;
 *   - sem link para o "site": o domínio da empresa É este sistema, e no celular
 *     ele levaria ao /install. O contato é o WhatsApp.
 */
export function PublicWorkPage() {
  useEffect(() => {
    document.title = COMPANY_INFO.name;
  }, []);

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-between overflow-hidden bg-[#F4F7F3] px-6 py-10 text-[#0F1F14]">
      {/* soft brand glow behind the content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#1FA34F]/15 blur-3xl"
      />

      <div />

      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <img src={BRAND_ASSETS.logo} alt={COMPANY_INFO.name} className="w-56 max-w-[70vw] select-none sm:w-64" draggable={false} />

        <h1 className="mt-10 text-balance text-[clamp(1.75rem,7vw,2.5rem)] font-extrabold leading-tight tracking-tight">
          Está procurando o quê, <span className="text-[#15803D]">curioso</span>?
        </h1>
        <p className="mt-4 max-w-xs text-pretty text-base text-[#4B5B50]">
          Este baú foi feito pela {COMPANY_INFO.name}. Logo, logo tem mais coisa aqui.
        </p>
      </div>

      <footer className="relative text-sm">
        <a
          href={whatsappLinkFor(COMPANY_INFO.phoneClean)}
          className="inline-flex items-center gap-1.5 font-medium text-[#0F1F14] underline-offset-4 hover:underline"
        >
          <IconBrandWhatsapp className="h-4 w-4 text-[#198A42]" stroke={2} />
          {COMPANY_INFO.phone}
        </a>
      </footer>
    </main>
  );
}

export default PublicWorkPage;
