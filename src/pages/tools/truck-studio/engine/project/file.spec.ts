/* O que este teste protege.
   ---------------------------------------------------------------------------
   O `.ankaastudio` existe para carregar uma configuração de um computador para
   outro e ela sair IGUAL. Essa promessa não é verificável olhando o código: ela
   é sobre um round trip, e um round trip só se prova rodando. Os casos abaixo
   são, um a um, um jeito conhecido de a promessa quebrar em silêncio — que é o
   modo de falha que importa aqui, porque quem importa o arquivo não tem como
   saber que o que está vendo não é o que foi salvo.

   Especificamente:

     · números que voltam ARREDONDADOS. Um `toFixed` no caminho, ou um campo que
       vira texto e volta, e a altura do baú fica um milímetro diferente. Ninguém
       percebe até a chapa ser cortada;
     · imagens que voltam DIFERENTES. Base64 → bytes → base64 é onde um byte se
       perde, e um PNG com um byte trocado ainda abre — só que errado;
     · imagens aninhadas em GRUPO, que a persistência antiga perdia inteiras;
     · a mesma imagem em faces diferentes virando entradas separadas, que é o
       que faz um arquivo de 6 MB pesar 18 MB;
     · um arquivo CORROMPIDO abrindo como se estivesse bom.

   Este arquivo roda em node sem WebGL, e é para isso que `./schema.ts` foi
   separado de `./document.ts` — ver o cabeçalho de lá. */
import { describe, it, expect } from 'vitest';

import { writeProjectFile, readProjectFile, projectFilename, ProjectFileError } from './file';
import { PROJECT_KIND, PROJECT_VERSION } from './schema';
import type { StudioProject } from './schema';

/* ---------------- material de teste ---------------- */

/* Um PNG 1×1 de verdade, e não uma string qualquer: `decodeDataUrl` olha o mime
   para escolher a extensão da entrada do ZIP, e um `data:` sem mime seguiria
   outro caminho. Os bytes abaixo são um PNG válido. */
const PNG_1PX = 'data:image/png;base64,'
  + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* Um segundo, DIFERENTE do primeiro — um JPEG, para provar que a extensão da
   entrada segue o mime e que dois conteúdos distintos não colidem. */
const JPEG_TINY = 'data:image/jpeg;base64,'
  + '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

/** Um número com muitas casas — se algo arredondar, este é o que denuncia. */
const AWKWARD_HEIGHT = 2.7947382910571;
const AWKWARD_LENGTH = 15.400000000000002;

function makeDoc(overrides: Partial<StudioProject> = {}): StudioProject {
  return {
    kind: PROJECT_KIND,
    version: PROJECT_VERSION,
    savedAt: '2026-08-17T12:34:56.789Z',
    name: 'Frota Águia',
    choice: {
      envId: 'distrito-industrial',
      manufacturerId: 'volvo',
      modelId: 'fh16',
      chassisId: '6x4',
      colorId: 'vermelho-ruby',
      finishId: null,
    },
    labels: {
      environment: 'Distrito Industrial',
      manufacturer: 'Volvo',
      model: 'FH16',
      chassis: '6x4',
      color: 'Vermelho Ruby',
    },
    scene: {
      preset: 'dourado', hour: 17.75, brightness: 1.0000000000000002,
      azManual: true, az: 269.83741, el: 11.4002,
      backdrop: 'grafite', fill: 0.83, rim: 1.21, softness: 0.94, temp: 5480,
    },
    paint: {
      finish: 'pearl', color: '#c01c28',
      metalness: 0.9, roughness: 0.28, gloss: 0.93,
      pearlAmount: 0.62, pearlMid: '#8f1220', pearlFlip: '#ae0034',
      pearlTravel: 2.1, flakeAmount: 0.34, flakeColor: '#ffd9a0',
      flakeDensity: 317.5, flakeTilt: 0.21, flakeGloss: 0.06,
      peel: 0.14, peelScale: 44.25, peelDetail: 0.3,
      coatThickness: 0.017, flakePx: 1.5,
    },
    vehicle: { implementPainted: true, view: 'both' },
    measures: {
      height: AWKWARD_HEIGHT,
      length: AWKWARD_LENGTH,
      doors: { left: [{ position: 1.234567, width: 1.2, height: 2.1 }] },
    },
    livery: {
      /* O QUADRO DE AUTORIA viaja junto — sem ele o pixel do fabric não é
         portátil e a arte volta na escala de outra máquina. Aqui ele existe só
         na face `left` de propósito: as outras provam que o campo é OPCIONAL e
         que um arquivo gravado antes desta correção continua abrindo. */
      left: {
        o: { version: '6.0.0', objects: [] }, bg: '#101010',
        frame: { px: { w: 2048, h: 389 }, mm: { w: 15400, h: 2777 } },
      },
      right: { o: { version: '6.0.0', objects: [] }, bg: '' },
      rear: { o: { version: '6.0.0', objects: [] }, bg: '' },
      front: { o: { version: '6.0.0', objects: [] }, bg: '' },
      roof: { o: { version: '6.0.0', objects: [] }, bg: '' },
    },
    camera: { pos: [8.13, 3.4021, -19.55], target: [0, 1.72, 0] },
    ...overrides,
  };
}

/** Põe objetos numa face. */
function withObjects(doc: StudioProject, face: 'left' | 'right' | 'rear', objects: unknown[]) {
  doc.livery[face] = { o: { version: '6.0.0', objects }, bg: doc.livery[face].bg };
  return doc;
}

const img = (src: string, extra: Record<string, unknown> = {}) => ({
  type: 'Image', left: 100, top: 50, scaleX: 0.5, scaleY: 0.5, src, ...extra,
});

/** Grava e lê de volta, devolvendo o documento que chegou do outro lado. */
async function roundTrip(doc: StudioProject) {
  const blob = await writeProjectFile(doc);
  return readProjectFile(blob);
}

/* Os ARQUIVOS de `assets/`, sem a entrada de PASTA.
   O JSZip cria `assets/` como uma entrada própria (`createFolders`, ligado por
   padrão) e ela aparece em `zip.files` junto com os arquivos. Um filtro por
   prefixo sozinho a conta como se fosse uma imagem — o que fez três casos
   falharem por um a mais, e fez um quarto substituir a PASTA em vez do arquivo
   que ele queria corromper. */
const assetPaths = (zip: { files: Record<string, { dir: boolean }> }) =>
  Object.keys(zip.files).filter((p) => p.startsWith('assets/') && !zip.files[p].dir).sort();

/* ---------------- os casos ---------------- */

describe('.ankaastudio — round trip', () => {
  it('devolve o documento inteiro, campo a campo', async () => {
    const doc = makeDoc();
    const { doc: back, problems } = await roundTrip(doc);
    expect(problems).toEqual([]);
    /* Igualdade PROFUNDA e não campo a campo escolhido a dedo: um teste que
       listasse os campos deixaria de cobrir o próximo que for acrescentado, e é
       justamente o campo novo que corre risco de ser esquecido no caminho. */
    expect(back).toEqual(doc);
  });

  it('não arredonda número nenhum', async () => {
    const { doc: back } = await roundTrip(makeDoc());
    expect(back.measures?.height).toBe(AWKWARD_HEIGHT);
    expect(back.measures?.length).toBe(AWKWARD_LENGTH);
    expect(back.measures?.doors.left?.[0].position).toBe(1.234567);
    expect(back.scene.brightness).toBe(1.0000000000000002);
    expect(back.paint.flakeDensity).toBe(317.5);
    expect(back.camera?.pos).toEqual([8.13, 3.4021, -19.55]);
  });

  it('não muda o documento de origem ao gravar', async () => {
    const doc = withObjects(makeDoc(), 'left', [img(PNG_1PX)]);
    const before = JSON.parse(JSON.stringify(doc));
    await writeProjectFile(doc);
    /* O `src` vira um caminho de dentro do ZIP durante a gravação. Se isso
       vazasse para o objeto do chamador, o "Salvar" logo depois de "Exportar"
       guardaria na biblioteca um documento apontando para `assets/…png` — um
       caminho que a biblioteca não tem, e uma plotagem que volta vazia. */
    expect(doc).toEqual(before);
  });
});

describe('.ankaastudio — as imagens', () => {
  it('devolve o data URL byte a byte', async () => {
    const doc = withObjects(makeDoc(), 'left', [img(PNG_1PX), img(JPEG_TINY)]);
    const { doc: back } = await roundTrip(doc);
    const objs = back.livery.left.o.objects as { src: string }[];
    expect(objs[0].src).toBe(PNG_1PX);
    expect(objs[1].src).toBe(JPEG_TINY);
  });

  it('encontra imagem dentro de grupo', async () => {
    /* O defeito que isto tranca: a varredura antiga só olhava o primeiro nível,
       então agrupar um logo com um texto — a coisa mais natural do mundo num
       editor — fazia a imagem daquele grupo ser gravada com uma URL de sessão
       que morre com a aba. */
    const doc = withObjects(makeDoc(), 'left', [
      {
        type: 'Group',
        objects: [
          { type: 'Textbox', text: 'ÁGUIA' },
          img(PNG_1PX),
          { type: 'Group', objects: [img(JPEG_TINY)] },
        ],
      },
    ]);
    const { doc: back } = await roundTrip(doc);
    const group = (back.livery.left.o.objects as { objects: { src?: string; objects?: { src: string }[] }[] }[])[0];
    expect(group.objects[1].src).toBe(PNG_1PX);
    expect(group.objects[2].objects?.[0].src).toBe(JPEG_TINY);
  });

  it('guarda a mesma imagem UMA vez, em qualquer face e qualquer profundidade', async () => {
    const doc = makeDoc();
    withObjects(doc, 'left', [img(PNG_1PX), img(PNG_1PX)]);
    withObjects(doc, 'right', [img(PNG_1PX)]);
    withObjects(doc, 'rear', [{ type: 'Group', objects: [img(PNG_1PX)] }]);

    const blob = await writeProjectFile(doc);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    expect(assetPaths(zip)).toHaveLength(1);

    /* E as quatro referências continuam apontando para a imagem certa. */
    const { doc: back } = await roundTrip(doc);
    expect((back.livery.left.o.objects as { src: string }[])[0].src).toBe(PNG_1PX);
    expect((back.livery.right.o.objects as { src: string }[])[0].src).toBe(PNG_1PX);
  });

  it('nomeia a entrada pelo hash do conteúdo, com a extensão do mime', async () => {
    const doc = withObjects(makeDoc(), 'left', [img(PNG_1PX), img(JPEG_TINY)]);
    const blob = await writeProjectFile(doc);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const assets = assetPaths(zip);
    expect(assets).toHaveLength(2);
    for (const p of assets) expect(p).toMatch(/^assets\/[0-9a-f]{64}\.(png|jpg)$/);
    expect(assets.some((p) => p.endsWith('.png'))).toBe(true);
    expect(assets.some((p) => p.endsWith('.jpg'))).toBe(true);
  });

  it('gera o MESMO conteúdo interno ao gravar duas vezes', async () => {
    /* O endereço é o hash, então dois arquivos do mesmo projeto têm os mesmos
       caminhos internos — é o que torna dois projetos comparáveis com um
       `unzip -l`, e é o sinal de que nada no caminho depende de contador nem de
       ordem de iteração. */
    const doc = withObjects(makeDoc(), 'left', [img(PNG_1PX), img(JPEG_TINY)]);
    const JSZip = (await import('jszip')).default;
    const names = async () => Object.keys(
      (await JSZip.loadAsync(await writeProjectFile(doc))).files,
    ).sort();
    expect(await names()).toEqual(await names());
  });
});

describe('.ankaastudio — integridade', () => {
  it('recusa um arquivo que não é um zip', async () => {
    const junk = new Blob(['isto não é um projeto'], { type: 'text/plain' });
    await expect(readProjectFile(junk)).rejects.toBeInstanceOf(ProjectFileError);
  });

  it('recusa um zip sem project.json', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('leiame.txt', 'oi');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(readProjectFile(blob)).rejects.toThrow(/project\.json/);
  });

  it('recusa um project.json adulterado', async () => {
    /* O caso que o digest existe para pegar: o arquivo abre, o JSON é válido, e
       o conteúdo NÃO é o que foi assinado. Sem a conferência isto viraria uma
       cena silenciosamente diferente da que foi salva. */
    const JSZip = (await import('jszip')).default;
    const original = await writeProjectFile(makeDoc());
    const zip = await JSZip.loadAsync(original);
    const doc = JSON.parse(await zip.file('project.json')!.async('string')) as StudioProject;
    doc.measures!.height = 9.99;
    zip.file('project.json', JSON.stringify(doc));
    const tampered = await zip.generateAsync({ type: 'blob' });
    await expect(readProjectFile(tampered)).rejects.toThrow(/corrompido/i);
  });

  it('recusa um formato de versão futura', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await writeProjectFile(makeDoc()));
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    manifest.version = PROJECT_VERSION + 1;
    zip.file('manifest.json', JSON.stringify(manifest));
    await expect(readProjectFile(await zip.generateAsync({ type: 'blob' })))
      .rejects.toThrow(/versão mais nova/i);
  });

  it('recusa um documento de outra ferramenta', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify({ kind: 'outra.coisa', choice: {}, livery: {} }));
    await expect(readProjectFile(await zip.generateAsync({ type: 'blob' })))
      .rejects.toThrow(/não é um projeto/i);
  });

  it('descarta a imagem corrompida e RELATA, em vez de derrubar o projeto', async () => {
    /* A assimetria que o cabeçalho de `readProjectFile` declara: abrir um
       projeto sem um dos logos é muito melhor do que não abrir. */
    const JSZip = (await import('jszip')).default;
    const doc = withObjects(makeDoc(), 'left', [img(PNG_1PX)]);
    const zip = await JSZip.loadAsync(await writeProjectFile(doc));
    const [assetPath] = assetPaths(zip);
    zip.file(assetPath, new Uint8Array([1, 2, 3, 4]));

    const { doc: back, problems } = await readProjectFile(await zip.generateAsync({ type: 'blob' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/corrompida/i);
    /* String VAZIA e não o caminho: deixar `assets/…png` faria o fabric buscá-lo
       na origem do app e encher o console de 404 para todo mundo que abrisse. */
    expect((back.livery.left.o.objects as { src: string }[])[0].src).toBe('');
  });

  it('descarta a imagem ausente e RELATA', async () => {
    const JSZip = (await import('jszip')).default;
    const doc = withObjects(makeDoc(), 'left', [img(PNG_1PX)]);
    const zip = await JSZip.loadAsync(await writeProjectFile(doc));
    zip.remove(assetPaths(zip)[0]);

    const { problems } = await readProjectFile(await zip.generateAsync({ type: 'blob' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/não está no arquivo/i);
  });
});

describe('.ankaastudio — o percurso de câmera', () => {
  const key = (n: number, thumb: string | null) => ({
    px: n + 0.123456789, py: 3.5, pz: -19.25,
    tx: 0, ty: 1.72, tz: 0,
    fov: 28.5, travel: n === 0 ? 0 : 2.5, thumb,
  });

  it('atravessa com as poses exatas e as miniaturas', async () => {
    const doc = makeDoc({ timeline: [key(0, PNG_1PX), key(1, JPEG_TINY), key(2, null)] });
    const { doc: back } = await roundTrip(doc);
    expect(back.timeline).toEqual(doc.timeline);
    /* A pose é o que decide para onde a câmera vai. Um arredondamento aqui é um
       enquadramento diferente do que a pessoa marcou, e um vídeo que não fecha o
       laço no ponto certo. */
    expect(back.timeline![1].px).toBe(1.123456789);
  });

  it('guarda a miniatura do percurso como asset binário, e deduplica com a plotagem', async () => {
    /* O MESMO cofre de assets serve as duas fontes de imagem do documento — é o
       ponto de `imageSlots()`. Um logo e uma miniatura com bytes idênticos são
       uma entrada só; e uma miniatura NÃO pode ficar em base64 dentro do
       project.json, senão 24 quadros de cena voltam a inflar o arquivo em 33 %. */
    const doc = withObjects(makeDoc({ timeline: [key(0, PNG_1PX)] }), 'left', [img(PNG_1PX)]);
    const blob = await writeProjectFile(doc);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    expect(assetPaths(zip)).toHaveLength(1);

    const projectText = await zip.file('project.json')!.async('string');
    expect(projectText).not.toContain('data:image');

    const { doc: back } = await roundTrip(doc);
    expect(back.timeline![0].thumb).toBe(PNG_1PX);
    expect((back.livery.left.o.objects as { src: string }[])[0].src).toBe(PNG_1PX);
  });

  it('o quadro de autoria da plotagem atravessa intacto', async () => {
    /* Se este campo se perder, a arte volta na escala da máquina de origem e o
       sintoma é uma logo "esticada" — sem erro em lugar nenhum. */
    const { doc: back } = await roundTrip(makeDoc());
    expect(back.livery.left.frame).toEqual({ px: { w: 2048, h: 389 }, mm: { w: 15400, h: 2777 } });
    expect(back.livery.right.frame).toBeUndefined();
  });

  it('um documento sem percurso continua sem percurso', async () => {
    const { doc: back } = await roundTrip(makeDoc());
    expect(back.timeline).toBeUndefined();
  });
});

describe('.ankaastudio — a miniatura', () => {
  it('viaja quando existe e não é obrigatória', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const preview = new Blob([bytes], { type: 'image/jpeg' });
    const withPreview = await readProjectFile(await writeProjectFile(makeDoc(), { preview }));
    expect(withPreview.preview).not.toBeNull();
    /* `size` + `type`, e não uma comparação dos bytes: o `Blob` do jsdom desta
       versão NÃO implementa `arrayBuffer()` nem `text()` (medido). Não é uma
       limitação do código — nada em `project/` chama esses métodos —, é o
       ambiente do teste, e uma asserção que dependesse deles estaria medindo o
       jsdom. O tamanho prova que os bytes atravessaram; o tipo prova que
       `readProjectFile` reconstrói o Blob com o mime certo, que é justamente o
       que `async('blob')` do JSZip não fazia. */
    expect(withPreview.preview!.size).toBe(bytes.length);
    expect(withPreview.preview!.type).toBe('image/jpeg');

    const without = await readProjectFile(await writeProjectFile(makeDoc()));
    expect(without.preview).toBeNull();
    expect(without.doc.name).toBe('Frota Águia');
  });
});

describe('projectFilename', () => {
  it('junta nome, modelo, cor e data, sem acento nem espaço', () => {
    expect(projectFilename(makeDoc()))
      .toBe('frota-aguia-fh16-vermelho-ruby-2026-08-17.ankaastudio');
  });

  it('cai num nome genérico quando não há de que se agarrar', () => {
    const doc = makeDoc({ name: undefined, labels: {} });
    expect(projectFilename(doc)).toBe('truck-studio-2026-08-17.ankaastudio');
  });
});
