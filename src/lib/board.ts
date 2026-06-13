import { supabase } from './supabase';

export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다. .env를 확인하세요.');
  return supabase;
}

/** 글 목록 — 최신순 */
export async function listPosts(): Promise<Post[]> {
  const { data, error } = await client()
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Post[];
}

/** 글 작성 — 로그인 필요(RLS가 author_id = auth.uid() 강제) */
export async function createPost(input: { title: string; content: string; author_id: string; author_name: string }): Promise<Post> {
  const { data, error } = await client().from('posts').insert(input).select().single();
  if (error) throw error;
  return data as Post;
}

/** 글 삭제 — 본인 글만(RLS) */
export async function deletePost(id: string): Promise<void> {
  const { error } = await client().from('posts').delete().eq('id', id);
  if (error) throw error;
}

/** 특정 글의 댓글 — 오래된순 */
export async function listComments(postId: string): Promise<Comment[]> {
  const { data, error } = await client()
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

/** 댓글 작성 */
export async function createComment(input: { post_id: string; content: string; author_id: string; author_name: string }): Promise<Comment> {
  const { data, error } = await client().from('comments').insert(input).select().single();
  if (error) throw error;
  return data as Comment;
}

/** 댓글 삭제 — 본인 댓글만(RLS) */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await client().from('comments').delete().eq('id', id);
  if (error) throw error;
}
