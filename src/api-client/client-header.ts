/**
 * `X-Client: web@<build>` — quem está chamando a API.
 *
 * É a metade web do censo de consultas (G3, pacote P06 do rework do
 * implemento): a API registra, por rota, as formas de include/where/orderBy
 * que cada cliente REALMENTE manda, e precisa saber se veio do web, do app
 * (`X-App-Version`) ou de outro. `<build>` é o hash curto do git gravado no
 * build (`__APP_HASH__`, o mesmo do `version.json`), o que separa um bundle
 * velho aberto numa aba esquecida do bundle atual.
 *
 * ⚠️ DESLIGADO POR PADRÃO. O web fala com a API por outra origem
 * (`api.ankaadesign.com.br`, e `localhost:3030` no dev), e um cabeçalho que não
 * está em `allowedHeaders` do CORS da API (`api/src/common/config/security.config.ts`)
 * reprova o preflight — TODA requisição do web cairia. Liga-se com
 * `VITE_SEND_X_CLIENT=1` no build, e só DEPOIS de a API em produção aceitar
 * `x-client` no CORS.
 */

export const CLIENT_HEADER = "X-Client";

export function clientBuildId(): string {
  return typeof __APP_HASH__ !== "undefined" && __APP_HASH__ ? __APP_HASH__ : "dev";
}

export function clientHeaderValue(): string {
  return `web@${clientBuildId()}`;
}

export function isClientHeaderEnabled(env: Record<string, unknown> = import.meta.env): boolean {
  const flag = env?.VITE_SEND_X_CLIENT;
  return flag === "1" || flag === "true" || flag === true;
}
