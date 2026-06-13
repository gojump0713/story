import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Stack, Field } from './ui';
import { authEnabled, useAuth, signIn, signUp, signOut, displayName } from './lib/auth';
import {
  listPosts, createPost, deletePost,
  listComments, createComment, deleteComment,
  type Post, type Comment,
} from './lib/board';

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

/** 로그인 / 회원가입 폼 */
function AuthPanel({ color }: { color: string }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setMsg(null);
    if (!email.trim() || pw.length < 6) { setErr('이메일과 6자 이상 비밀번호를 입력하세요.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') {
        await signUp(email.trim(), pw);
        setMsg('가입 완료! 이메일 확인이 켜져 있다면 메일의 링크를 눌러 인증 후 로그인하세요.');
      } else {
        await signIn(email.trim(), pw);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '인증에 실패했습니다.');
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className={`sb-mode__btn ${mode === 'in' ? 'on' : ''}`} style={mode === 'in' ? { background: color, color: '#fff', borderColor: color } : undefined} onClick={() => { setMode('in'); setErr(null); setMsg(null); }}>로그인</button>
        <button type="button" className={`sb-mode__btn ${mode === 'up' ? 'on' : ''}`} style={mode === 'up' ? { background: color, color: '#fff', borderColor: color } : undefined} onClick={() => { setMode('up'); setErr(null); setMsg(null); }}>회원가입</button>
      </div>
      <Stack gap={12}>
        <Field label="이메일"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
        <Field label="비밀번호" hint="6자 이상"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
        {err && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>⚠️ {err}</p>}
        {msg && <p style={{ margin: 0, color: '#047857', fontSize: 13 }}>✅ {msg}</p>}
        <button className="btn" style={{ background: color }} disabled={busy} onClick={submit}>
          {busy ? '처리 중…' : mode === 'up' ? '✨ 가입하기' : '🔓 로그인'}
        </button>
      </Stack>
    </div>
  );
}

/** 댓글 영역 */
function Comments({ post, user, color }: { post: Post; user: User; color: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => { listComments(post.id).then(setItems).catch(() => { /* ignore */ }); };
  useEffect(load, [post.id]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await createComment({ post_id: post.id, content: text.trim(), author_id: user.id, author_name: displayName(user) });
      setText(''); load();
    } catch { /* ignore */ }
    setBusy(false);
  };
  const remove = async (id: string) => { try { await deleteComment(id); load(); } catch { /* ignore */ } };

  return (
    <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <strong style={{ fontSize: 14 }}>💬 댓글 {items.length}</strong>
      <Stack gap={8}>
        {items.map((c) => (
          <div key={c.id} className="box" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--faint)' }}>{c.author_name} · {fmt(c.created_at)}</div>
              <div style={{ fontSize: 14, marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.content}</div>
            </div>
            {c.author_id === user.id && <button className="sb-shelf__del" style={{ position: 'static' }} onClick={() => remove(c.id)}>✕</button>}
          </div>
        ))}
      </Stack>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="댓글을 입력하세요" style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" style={{ background: color, padding: '8px 14px' }} disabled={busy} onClick={add}>등록</button>
      </div>
    </div>
  );
}

/** 게시판 본체 (로그인 후) */
function BoardInner({ user, color }: { user: User; color: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Post | null>(null);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listPosts().then(setPosts).catch((e) => setErr(e instanceof Error ? e.message : '불러오기 실패')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async () => {
    if (!title.trim() || !content.trim()) { setErr('제목과 내용을 입력하세요.'); return; }
    setBusy(true); setErr(null);
    try {
      await createPost({ title: title.trim(), content: content.trim(), author_id: user.id, author_name: displayName(user) });
      setTitle(''); setContent(''); setWriting(false); load();
    } catch (e) { setErr(e instanceof Error ? e.message : '작성 실패'); }
    setBusy(false);
  };
  const remove = async (p: Post) => {
    if (!confirm('이 글을 삭제할까요?')) return;
    try { await deletePost(p.id); setOpen(null); load(); } catch (e) { setErr(e instanceof Error ? e.message : '삭제 실패'); }
  };

  // 상세 보기
  if (open) {
    return (
      <Stack gap={14}>
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(null)}>← 목록</button>
        <div className="card">
          <h2 style={{ margin: '0 0 6px' }}>{open.title}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{open.author_name} · {fmt(open.created_at)}</div>
          <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{open.content}</p>
          {open.author_id === user.id && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, color: '#dc2626' }} onClick={() => remove(open)}>🗑 삭제</button>
            </div>
          )}
          <Comments post={open} user={user} color={color} />
        </div>
      </Stack>
    );
  }

  // 글쓰기
  if (writing) {
    return (
      <Stack gap={14}>
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { setWriting(false); setErr(null); }}>← 목록</button>
        <div className="card">
          <h3 style={{ margin: '0 0 14px' }}>✍️ 새 글 작성</h3>
          <Stack gap={12}>
            <Field label="제목"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" /></Field>
            <Field label="내용"><textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용을 입력하세요" /></Field>
            {err && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>⚠️ {err}</p>}
            <button className="btn" style={{ background: color }} disabled={busy} onClick={submit}>{busy ? '등록 중…' : '📝 등록'}</button>
          </Stack>
        </div>
      </Stack>
    );
  }

  // 목록
  return (
    <Stack gap={14}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0 }}>💬 게시판</h3>
        <button className="btn" style={{ background: color, padding: '8px 16px' }} onClick={() => { setWriting(true); setErr(null); }}>✍️ 글쓰기</button>
      </div>
      {err && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>⚠️ {err}</p>}
      {loading && <p style={{ color: 'var(--faint)', fontSize: 14 }}>불러오는 중…</p>}
      {!loading && posts.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 14 }}>아직 글이 없어요. 첫 글을 작성해 보세요!</p>}
      <Stack gap={8}>
        {posts.map((p) => (
          <button key={p.id} className="box" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }} onClick={() => setOpen(p)}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>{p.author_name} · {fmt(p.created_at)}</div>
            </div>
            <span style={{ color: 'var(--faint)', flexShrink: 0 }}>›</span>
          </button>
        ))}
      </Stack>
    </Stack>
  );
}

/** 게시판 탭 진입점 — Supabase 미설정/비로그인/로그인 상태 분기 */
export default function Board({ color }: { color: string }) {
  const { user, loading } = useAuth();

  if (!authEnabled) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h3 style={{ marginTop: 0 }}>⚙️ Supabase 설정이 필요해요</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
          게시판·로그인은 Supabase 연동이 필요합니다. 프로젝트 루트의 <code>.env</code>에
          <code> VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>를 채우고 개발 서버를 재시작하세요.
        </p>
      </div>
    );
  }

  if (loading) return <p style={{ color: 'var(--faint)', textAlign: 'center' }}>불러오는 중…</p>;

  if (!user) {
    return (
      <Stack gap={16}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px' }}>🔐 로그인하고 게시판을 이용하세요</h3>
          <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: 0 }}>이메일·비밀번호로 가입하면 글과 댓글을 쓸 수 있어요.</p>
        </div>
        <AuthPanel color={color} />
      </Stack>
    );
  }

  return (
    <Stack gap={14}>
      <div className="box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderColor: `${color}55`, background: `${color}10` }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color }}>👤 {displayName(user)} 님으로 로그인됨</span>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => signOut()}>로그아웃</button>
      </div>
      <BoardInner user={user} color={color} />
    </Stack>
  );
}
