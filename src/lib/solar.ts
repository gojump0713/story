/**
 * Upstage Solar 챗봇 클라이언트 — Supabase Edge Function('chat') 프록시 호출.
 * Upstage 키는 서버(Edge)에만 있고, 여기서는 로그인 사용자의 access_token만 보낸다.
 * 응답(OpenAI 호환 SSE)을 파싱해 토큰 단위로 onToken에 흘려보낸다.
 */
import { supabase } from './supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface ChatTurn { role: 'system' | 'user' | 'assistant'; content: string; }

/** 챗봇 프록시 사용 가능 여부 — Supabase 설정이 있어야 함 */
export const solarEnabled = (): boolean => !!supabase;

/**
 * Edge Function을 통해 Solar에 스트리밍 채팅.
 * 로그인돼 있지 않으면 NO_AUTH throw. signal로 중단 가능.
 */
export async function solarStream(
  messages: ChatTurn[],
  onToken: (delta: string) => void,
  opts: { temperature?: number; max_tokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  if (!supabase) throw new Error('NO_SUPABASE');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('NO_AUTH');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(ANON ? { apikey: ANON } : {}),
    },
    signal: opts.signal,
    body: JSON.stringify({ messages, temperature: opts.temperature, max_tokens: opts.max_tokens }),
  });

  if (!res.ok || !res.body) {
    // 함수가 JSON 에러를 돌려주면 메시지를 끌어낸다.
    let detail = `오류 ${res.status}`;
    try { const j = await res.json(); if (j?.error) detail = j.error; } catch { /* ignore */ }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) { full += delta; onToken(delta); }
      } catch { /* keep-alive 등 무시 */ }
    }
  }
  return full;
}
