// web/src/components/cliente/portal-dialog.ts
//
// O DIÁLOGO DO PORTAL VIRA TELA CHEIA NO CELULAR.
//
// O `DialogContent` da casa é uma caixa centrada de `max-w-lg`. Num telefone de
// 360–390 px isso é uma caixa colada nas bordas, com o teclado subindo por cima
// do campo e o botão de confirmar escondido embaixo dele. Abaixo de `sm` o
// diálogo do portal ocupa a tela inteira (`h-dvh`, sem cantos, rolando por
// dentro) — o mesmo gesto de uma folha de baixo para cima, sem um segundo
// componente para manter. Do `sm` para cima nada muda.
//
// Uso: `<DialogContent className={cn(PORTAL_SHEET_ON_MOBILE, "sm:max-w-md")}>`.
export const PORTAL_SHEET_ON_MOBILE =
  "max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none " +
  "max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:overflow-y-auto " +
  "max-sm:content-start max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] " +
  "max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=open]:slide-in-from-top-0 " +
  "max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=closed]:slide-out-to-top-0";

/**
 * O rodapé de ações do diálogo no celular: botões empilhados, de largura cheia e
 * com 44 px de altura — o dedo, não o cursor.
 */
export const PORTAL_DIALOG_FOOTER =
  "flex-col-reverse gap-2 sm:flex-row sm:gap-0 [&>button]:h-11 sm:[&>button]:h-10 [&>button]:w-full sm:[&>button]:w-auto";
