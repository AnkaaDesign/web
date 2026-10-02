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

/**
 * The system shrinks its whole UI to 90% through the root font-size (index.css, GLOBAL UI SCALE) —
 * right for a dense desktop app, wrong for a page read on a phone. Full size while this page is up.
 */
function useFullSizeType() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = "100%";
    return () => {
      root.style.fontSize = previous;
    };
  }, []);
}

export function PublicWorkPage() {
  useDeviceThemeForVisitors();
  useFullSizeType();

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

      <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        <img src={BRAND_ASSETS.logo} alt={COMPANY_INFO.name} className="w-[min(80vw,22rem)] select-none" draggable={false} />

        <h1 className="mt-12 text-balance text-[clamp(2.25rem,10vw,3.25rem)] font-extrabold leading-[1.1] tracking-tight">
          Está procurando o quê, <span className="text-primary">curioso</span>?
        </h1>
        <p className="mt-6 text-[clamp(1.125rem,4.8vw,1.375rem)] text-muted-foreground">Este baú foi feito pela {COMPANY_INFO.name}.</p>
        <p className="mt-1.5 text-[clamp(1.125rem,4.8vw,1.375rem)] text-muted-foreground">Logo, logo tem mais coisa por aqui.</p>
      </div>

      <footer className="relative text-base">
        <a
          href={whatsappLinkFor(COMPANY_INFO.phoneClean)}
          className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
        >
          <IconBrandWhatsapp className="h-5 w-5 text-primary" stroke={2} />
          {COMPANY_INFO.phone}
        </a>
      </footer>
    </main>
  );
}

export default PublicWorkPage;
