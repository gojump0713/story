import { useEffect, useRef, useState } from 'react';
import { Stack } from './ui';
import { AuthPanel } from './Board';
import { authEnabled, useAuth, signOut, displayName } from './lib/auth';
import { solarStream, type ChatTurn } from './lib/solar';

/* ──────────────────────────────────────────────────────────────────────────
 * 동화 도우미 챗봇 — Upstage Solar 기반 친절한 한국어 도우미.
 * 키는 Supabase Edge Function('chat')에 보관되고, 여기서는 로그인 사용자의
 * 토큰만 보낸다(키 노출 없음). 대화는 localStorage에 저장해 새로고침해도 이어진다.
 * ────────────────────────────────────────────────────────────────────────── */

const LS = 'chatbot.history.v1';

const SYSTEM = `너는 '동화 도우미'라는 이름의 친절한 한국어 AI야. 한국형 AI 동화책 제작 스튜디오 안에서 부모와 아이를 돕는다.
- 따뜻하고 다정한 말투로, 이모지를 적절히 섞어 쉽게 설명한다.
- 동화 아이디어 제안, 줄거리 다듬기, 한국 전통 소재(탈춤·한복·설날·도깨비·호랑이 등) 설명, 아이에게 책 읽어주는 팁, 독후활동 아이디어를 잘 안다.
- 답변은 너무 길지 않게, 핵심을 먼저 말하고 필요하면 짧은 목록으로 정리한다.
- 아이에게 부적절한 내용은 다루지 않고, 건강하고 교육적인 방향으로 안내한다.`;

const SUGGESTIONS = [
  '🦊 용기를 주제로 한 동화 아이디어 3개 알려줘',
  '👹 도깨비가 나오는 이야기를 만들고 싶어',
  '📖 5살 아이에게 책 읽어주는 팁이 있을까?',
  '🎨 동화를 읽고 할 수 있는 독후활동 추천해줘',
];

const GREETING =
  '안녕하세요! 저는 동화 도우미예요 🧚\n동화 아이디어, 줄거리 다듬기, 한국 전통 소재, 책 읽어주는 팁까지 무엇이든 물어보세요. 아래 추천 질문을 눌러도 좋아요!';

interface ChatMsg { role: 'user' | 'assistant'; content: string }

function loadHistory(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; }
  } catch { /* ignore */ }
  return [{ role: 'assistant', content: GREETING }];
}

/** 실제 대화 화면 (로그인 후) */
function ChatRoom({ color }: { color: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ } }, [msgs]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setErr(null);
    setInput('');

    const history = [...msgs, { role: 'user' as const, content }];
    setMsgs([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const payload: ChatTurn[] = [
      { role: 'system', content: SYSTEM },
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    ];
    try {
      await solarStream(payload, (delta) => {
        setMsgs((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + delta };
          return next;
        });
      }, { signal: ctrl.signal, temperature: 0.85 });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setErr(e instanceof Error ? e.message : '응답을 받지 못했어요.');
        setMsgs((m) => {
          const next = [...m];
          if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1].content) next.pop();
          return next;
        });
      }
    }
    setBusy(false);
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();
  const reset = () => {
    abortRef.current?.abort();
    setMsgs([{ role: 'assistant', content: GREETING }]);
    setErr(null);
  };

  return (
    <>
      <div className="cb-window" ref={scrollRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`cb-row ${m.role}`}>
            {m.role === 'assistant' && <span className="cb-avatar" style={{ background: `${color}1a` }}>🧚</span>}
            <div className="cb-bubble" style={m.role === 'user' ? { background: color, color: '#fff' } : undefined}>
              {m.content || (busy ? <span className="cb-typing"><i /><i /><i /></span> : '')}
            </div>
          </div>
        ))}
      </div>

      {err && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>⚠️ {err}</p>}

      {msgs.length <= 1 && (
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="cb-suggest" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="cb-input">
        <textarea
          rows={1}
          value={input}
          placeholder="동화 도우미에게 물어보세요…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
        />
        {busy
          ? <button className="btn btn-ghost" style={{ padding: '0 16px' }} onClick={stop}>■ 멈춤</button>
          : <button className="btn" style={{ background: color, padding: '0 18px' }} disabled={!input.trim()} onClick={() => send(input)}>보내기</button>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={reset}>🗑 대화 비우기</button>
      </div>
    </>
  );
}

/** 챗봇 탭 진입점 — Supabase 미설정/비로그인/로그인 상태로 분기 */
export default function Chatbot({ color }: { color: string }) {
  const { user, loading } = useAuth();

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <h3 style={{ margin: 0 }}>🤖 동화 도우미 챗봇</h3>
      {user && (
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => signOut()}>로그아웃</button>
      )}
    </div>
  );

  if (!authEnabled) {
    return (
      <Stack gap={12}>
        {header}
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h3 style={{ marginTop: 0 }}>⚙️ Supabase 설정이 필요해요</h3>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
            챗봇은 Upstage Solar를 Supabase Edge Function으로 안전하게 중계합니다.
            <code> .env</code>에 <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>를 채우고
            <code> chat</code> 함수를 배포한 뒤 사용할 수 있어요.
          </p>
        </div>
      </Stack>
    );
  }

  if (loading) return <Stack gap={12}>{header}<p style={{ color: 'var(--faint)', textAlign: 'center' }}>불러오는 중…</p></Stack>;

  if (!user) {
    return (
      <Stack gap={16}>
        {header}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px' }}>🔐 로그인하고 챗봇과 대화하세요</h3>
          <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: 0 }}>이메일·비밀번호로 로그인하면 동화 도우미와 이야기할 수 있어요.</p>
        </div>
        <AuthPanel color={color} />
      </Stack>
    );
  }

  return (
    <Stack gap={12}>
      {header}
      <div className="box" style={{ fontSize: 13, color: color, borderColor: `${color}55`, background: `${color}10` }}>
        👤 {displayName(user)} 님 · Upstage Solar로 답해드려요 ✨
      </div>
      <ChatRoom color={color} />
    </Stack>
  );
}
