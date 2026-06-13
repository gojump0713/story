/**
 * OpenAI Chat 호출 헬퍼.
 * 키 우선순위: 빌드 환경변수(VITE_OPENAI_API_KEY) → 사용자가 입력해 저장한 localStorage 키.
 * 정적 페이지에 키를 박지 않도록, 공개 배포본에서는 사용자가 자신의 키를 입력해 쓰는 방식을 권장한다.
 */
const ENV_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || '';
const LS = 'openai_api_key';
const MODEL = (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || 'gpt-4o-mini';

export const getKey = (): string => ENV_KEY || localStorage.getItem(LS) || '';
export const setKey = (k: string) => localStorage.setItem(LS, k.trim());
export const clearKey = () => localStorage.removeItem(LS);
export const hasKey = (): boolean => !!getKey();
export const keyFromEnv = (): boolean => !!ENV_KEY;

export interface Msg { role: 'system' | 'user' | 'assistant'; content: string; }

/** 채팅 완성 호출 — 키 없거나 실패 시 throw (호출부에서 폴백 처리) */
export async function chat(messages: Msg[], opts: { temperature?: number; max_tokens?: number; json?: boolean } = {}): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('NO_KEY');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.max_tokens ?? 900,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/** 시스템+유저 프롬프트 간편 호출 */
export const ask = (system: string, user: string, opts?: { temperature?: number; max_tokens?: number; json?: boolean }) =>
  chat([{ role: 'system', content: system }, { role: 'user', content: user }], opts);

/**
 * 동화 장면 삽화 생성.
 * 기본은 최신 이미지 모델 `gpt-image-1`을 쓰고, 계정에 없으면 `dall-e-3`로 폴백한다.
 * (계정마다 사용 가능한 모델이 달라, 둘 다 시도해 가장 먼저 성공하는 모델을 쓴다.)
 * 반환: data URL(b64) 또는 이미지 URL. 키 없거나 모두 실패 시 throw (호출부에서 이모지 폴백).
 */
const IMAGE_MODELS: string[] = (() => {
  const override = (import.meta.env.VITE_OPENAI_IMAGE_MODEL as string | undefined)?.trim();
  return override ? [override] : ['gpt-image-1', 'dall-e-3'];
})();

// gpt-image-1 과 dall-e-3 의 허용 사이즈가 달라 모델별로 보정한다.
function normalizeSize(model: string, size?: string): string {
  if (model.startsWith('gpt-image')) {
    if (size === '1792x1024') return '1536x1024';
    if (size === '1024x1792') return '1024x1536';
    return size && ['1024x1024', '1024x1536', '1536x1024', 'auto'].includes(size) ? size : '1024x1024';
  }
  return size && ['1024x1024', '1792x1024', '1024x1792'].includes(size) ? size : '1024x1024';
}

async function callImageModel(model: string, key: string, prompt: string, opts: { size?: string; quality?: 'standard' | 'hd' }): Promise<string> {
  const isGpt = model.startsWith('gpt-image');
  const body: Record<string, unknown> = { model, prompt, n: 1, size: normalizeSize(model, opts.size) };
  if (isGpt) {
    // gpt-image-1: response_format 미지원(항상 b64). quality는 low|medium|high|auto
    if (opts.quality) body.quality = opts.quality === 'hd' ? 'high' : 'medium';
  } else {
    // dall-e-3: b64로 받기(브라우저 CORS 회피). quality는 standard|hd
    body.response_format = 'b64_json';
    body.quality = opts.quality ?? 'standard';
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Image ${res.status} (${model}): ${t.slice(0, 140)}`);
  }
  const data = await res.json();
  const d = data.data?.[0] || {};
  if (d.b64_json) return `data:image/png;base64,${d.b64_json}`;
  if (d.url) return d.url as string;
  throw new Error(`NO_IMAGE (${model})`);
}

export async function generateImage(prompt: string, opts: { size?: '1024x1024' | '1792x1024' | '1024x1792' | '1024x1536'; quality?: 'standard' | 'hd' } = {}): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('NO_KEY');
  let lastErr: unknown;
  for (const model of IMAGE_MODELS) {
    try {
      return await callImageModel(model, key, prompt, opts);
    } catch (e) {
      lastErr = e;
      // 모델 미보유/파라미터 거부(400/403/404)면 다음 모델로 폴백, 그 외(401 인증·429 한도 등)는 즉시 중단
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.match(/Image (\d{3})/)?.[1];
      if (!(code === '400' || code === '403' || code === '404')) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('NO_IMAGE');
}
