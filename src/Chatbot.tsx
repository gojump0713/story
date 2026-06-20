import { useEffect, useRef, useState } from 'react';
import { Stack } from './ui';
import { chatStream, hasKey, type Msg } from './lib/ai';

/* ──────────────────────────────────────────────────────────────────────────
 * 동화 도우미 챗봇 — 부모·아이를 위한 친절한 한국어 AI 도우미.
 * OpenAI 키가 있으면 실시간 스트리밍 대화, 없으면 안내 폴백.
 * 대화는 localStorage에 저장해 새로고침해도 이어진다.
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

export default function Chatbot({ color }: { color: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ai = hasKey();

  // 대화 저장
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ } }, [msgs]);
  // 새 메시지마다 맨 아래로
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  // 언마운트 시 진행 중 스트림 중단
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setErr(null);
    setInput('');

    if (!ai) {
      setMsgs((m) => [...m, { role: 'user', content }, {
        role: 'assistant',
        content: '실시간 대화를 하려면 위쪽 “🔑 OpenAI 키” 칸에 키를 입력해 주세요. 키를 넣으면 제가 바로 도와드릴 수 있어요! 🙂',
      }]);
      return;
    }

    const history = [...msgs, { role: 'user' as const, content }];
    setMsgs([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const payload: Msg[] = [
      { role: 'system', content: SYSTEM },
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    ];
    try {
      await chatStream(payload, (delta) => {
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
          // 비어 있는 자리표시 응답 제거
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
    <Stack gap={12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <h3 style={{ margin: 0 }}>🤖 동화 도우미 챗봇</h3>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={reset}>🗑 대화 비우기</button>
      </div>
      {!ai && (
        <div className="box" style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--sub)' }}>
          💡 위쪽 <b>🔑 OpenAI 키</b>를 입력하면 실시간 대화가 켜집니다. (키는 브라우저에만 저장돼요)
        </div>
      )}

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
    </Stack>
  );
}
