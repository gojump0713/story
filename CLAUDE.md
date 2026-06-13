# CLAUDE.md — 바이브코딩 가이드 (project01)

이 저장소는 Claude Code 등 AI 코딩 도구로 개발하기 좋게 구성돼 있습니다.

## 스택
- Vite + React 18 + TypeScript
- Supabase(선택): `src/lib/supabase.ts`, `.env`(VITE_SUPABASE_URL/ANON_KEY)

## 규칙
- 변경 후에는 `npm run build`로 빌드가 통과하는지 확인하세요.
- 비밀키는 `.env`에만 두고 커밋하지 마세요(.gitignore 처리됨).
- 커밋 메시지는 한 줄 요약 + 필요한 설명.

## 자주 쓰는 요청 예시
- "src/App.tsx에 할 일 목록 화면을 만들어줘"
- "Supabase의 todos 테이블과 연동해 CRUD를 구현해줘"
- "GitHub Pages로 배포되게 설정 점검해줘"
