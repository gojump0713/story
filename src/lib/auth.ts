import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Supabase Auth 연결 여부 — .env에 URL/KEY가 있어야 true */
export const authEnabled = !!supabase;

/** 현재 세션을 구독하는 훅. supabase 미설정이면 항상 비로그인 상태. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

/** 회원가입 — 이메일/비밀번호. 이메일 확인이 켜져 있으면 확인 메일이 발송됨. */
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** 로그인 — 이메일/비밀번호 */
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** 로그아웃 */
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** 표시용 이름 — 이메일의 @ 앞부분 */
export function displayName(user: User | null): string {
  if (!user) return '익명';
  return user.email ? user.email.split('@')[0] : '사용자';
}
