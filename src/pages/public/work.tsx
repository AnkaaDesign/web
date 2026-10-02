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
 *   - sem link para o "site": o domínio da empresa É este sistema, e no celular
 *     ele levaria ao /install. O contato é o WhatsApp.
 *
 * TEMA: segue o do sistema (os tokens claro/escuro). Quem já usou o sistema
 * neste navegador vê o tema que escolheu; quem nunca usou — o caso de quem lê
 * um baú — não tem tema guardado, e aí vale o do aparelho.
 */
const THEME_STORAGE_KEY = "ankaa-ui-theme"; // the app ThemeProvider's key

function useDeviceThemeForVisitors() {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // storage blocked: treat as a visitor
    }
    if (stored) return; // the ThemeProvider already applied the person's own choice

    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let previous: string | null = null;
    const apply = () => {
      previous ??= root.classList.contains("dark") ? "dark" : "light";
      root.classList.remove("light", "dark");
      root.classList.add(media.matches ? "dark" : "light");
    };
    // next frame: child effects run before the parent's, and the ThemeProvider (a parent) would
    // otherwise paint its "light" default right over this
    const frame = requestAnimationFrame(apply);
    media.addEventListener("change", apply);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", apply);
      if (previous) {
        root.classList.remove("light", "dark");
        root.classList.add(previous);
      }
    };
  }, []);
}

export function PublicWorkPage() {
  useDeviceThemeForVisitors();

  useEffect(() => {
    document.title = COMPANY_INFO.name;
  }, []);

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-between overflow-hidden bg-background px-6 py-10 text-foreground">
      {/* faint dot grid, fading out towards the edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 text-foreground opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <div />

      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <img src={BRAND_ASSETS.logo} alt={COMPANY_INFO.name} className="w-56 max-w-[70vw] select-none sm:w-64" draggable={false} />

        <h1 className="mt-10 text-balance text-[clamp(1.75rem,7vw,2.5rem)] font-extrabold leading-tight tracking-tight">
          Está procurando o quê, <span className="text-primary">curioso</span>?
        </h1>
        <p className="mt-4 text-base text-muted-foreground">Este baú foi feito pela {COMPANY_INFO.name}.</p>
        <p className="mt-1 text-base text-muted-foreground">Logo, logo tem mais coisa por aqui.</p>
      </div>

      <footer className="relative text-sm">
        <a
          href={whatsappLinkFor(COMPANY_INFO.phoneClean)}
          className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
        >
          <IconBrandWhatsapp className="h-4 w-4 text-primary" stroke={2} />
          {COMPANY_INFO.phone}
        </a>
      </footer>
    </main>
  );
}

export default PublicWorkPage;
