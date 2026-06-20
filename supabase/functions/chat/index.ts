// Supabase Edge Function: Upstage Solar 챗봇 프록시
//
// 목적: Upstage API 키를 클라이언트에 노출하지 않기 위해 서버(Edge)에서만 보관하고,
//       로그인한 사용자의 요청만 Upstage로 중계해 응답을 SSE 스트림으로 흘려보낸다.
//
// 배포 전 준비:
//   supabase secrets set UPSTAGE_API_KEY=up_xxx   (필수)
//   supabase secrets set UPSTAGE_MODEL=solar-pro2 (선택 · 기본 solar-pro2)
//
// 호출: POST { messages: [{role, content}], temperature?, max_tokens? }
//       Authorization 헤더에 로그인 사용자의 access_token 필요(verify_jwt).

const UPSTAGE_URL = 'https://api.upstage.ai/v1/chat/completions';
const DEFAULT_MODEL = Deno.env.get('UPSTAGE_MODEL') || 'solar-pro2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** JWT payload의 role 클레임을 읽어 anon/authenticated를 구분 (서명 검증은 플랫폼이 이미 수행) */
function jwtRole(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  // 로그인 사용자만 허용 (무단 호출·과금 방지). anon 키만으로는 거부.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (jwtRole(token) !== 'authenticated') {
    return json({ error: '로그인이 필요합니다. 게시판 탭에서 로그인 후 이용해 주세요.' }, 401);
  }

  const key = Deno.env.get('UPSTAGE_API_KEY');
  if (!key) return json({ error: '서버에 UPSTAGE_API_KEY가 설정되지 않았습니다.' }, 500);

  let body: { messages?: unknown; temperature?: unknown; max_tokens?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: '잘못된 요청 형식입니다.' }, 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'messages 배열이 필요합니다.' }, 400);
  }

  const upstream = await fetch(UPSTAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: typeof body.model === 'string' ? body.model : DEFAULT_MODEL,
      messages: body.messages,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.85,
      max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 900,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => '');
    return json({ error: `Upstage ${upstream.status}: ${t.slice(0, 200)}` }, 502);
  }

  // Upstage는 OpenAI 호환 SSE를 보낸다 — 그대로 클라이언트로 통과시킨다.
  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
});
