/* A miniatura de um projeto.
   ---------------------------------------------------------------------------
   Ela NÃO é estado — nada nela é aplicado na volta. Ela existe porque uma
   biblioteca de projetos com seis linhas de texto é uma lista de arquivos, e
   com seis imagens é uma prateleira: quem salvou cinco variações da mesma
   plotagem reconhece a certa pela cor e pelo desenho, nunca pelo nome que deu
   às pressas.

   POR QUE `captureViewport({quality:'low'})` E NÃO `canvas.toDataURL()`

   O renderer nasce SEM `preserveDrawingBuffer` (decisão medida — ver o
   comentário no construtor em scene/scene.ts: o flag custa um buffer inteiro a
   mais e uma cópia em todo present, para servir um botão apertado meia dúzia de
   vezes por sessão). Sem ele, o buffer é apagado assim que o quadro é composto,
   e um `toDataURL()` fora do mesmo task do `render()` devolve preto. Acertar
   essa janela daqui exigiria um gancho dentro do laço de render — ou seja,
   reimplementar o que `capture.ts` já faz certo.

   E o preset `low` é barato de propósito: 1920 de aresta longa, UM ladrilho,
   sem realocar o mapa de sombra. É um passe de render, da ordem do que a vista
   ao vivo já paga por quadro — não os dezesseis passes do preset alto.

   O RESULTADO É REDUZIDO AQUI, e é isso que torna a coisa guardável: 1920 px
   viram 480, e um JPEG a 0,72 fecha em algumas dezenas de kB. Guardar o WebP de
   1920 seria pôr meio megabyte de enfeite dentro de cada projeto — num arquivo
   que se manda por e-mail, isso é o enfeite pesando mais que o conteúdo. */
import { captureViewport } from '../scene/capture';

/** Aresta longa da miniatura guardada. Dois cards de 240 px em tela retina. */
const THUMB_EDGE = 480;

/**
 * Uma miniatura JPEG da cena, ou `null` se não deu.
 *
 * NUNCA LANÇA. Miniatura é enfeite: uma captura que falha (a placa recusou o
 * alvo, a aba está em segundo plano, o contexto se perdeu) não pode impedir
 * alguém de salvar o trabalho. Quem chama trata `null` como "sem imagem" e seg
 * em frente.
 */
export async function captureThumbnail(): Promise<Blob | null> {
  try {
    const shot = await captureViewport({ quality: 'low', background: 'cena' });
    return await downscale(shot.blob, THUMB_EDGE);
  } catch {
    return null;
  }
}

/** Reduz um blob de imagem para caber numa caixa de `edge` px e reencoda em JPEG. */
async function downscale(src: Blob, edge: number): Promise<Blob | null> {
  /* `createImageBitmap` decodifica FORA da thread principal e não precisa de um
     `<img>` no documento nem de uma object URL para revogar depois. */
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(src); } catch { return null; }

  const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bmp.close(); return null; }
  /* A redução é grande (4×), e sem isto o navegador amostra por vizinho mais
     próximo em alguns motores — o que serrilha justamente as linhas finas da
     ferragem do baú, que é o que se está tentando reconhecer na miniatura. */
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  /* JPEG e não WebP: a miniatura vive dentro de um arquivo que atravessa
     e-mail e sistemas de arquivo alheios, e JPEG é o que qualquer visualizador
     abre. Sem alfa a perder — o fundo aqui é a cena. */
  return new Promise((resolve) => {
    try { canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72); }
    catch { resolve(null); }
  });
}
