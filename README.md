# project01

AI Reboot Academy 팀 프로젝트 저장소입니다. (Vite + React + TypeScript + Supabase)

## 시작하기
```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 → http://localhost:5173
```

## 폴더
- `src/App.tsx` — 메인 화면 (여기서부터 개발)
- `src/lib/supabase.ts` — Supabase 클라이언트 (선택)
- `.env.example` — Supabase 사용 시 `.env`로 복사해 값 입력 (`.env`는 커밋 금지)

## 배포 (GitHub Pages)
- `main`에 push하면 GitHub Actions가 자동 빌드·배포합니다. (Settings → Pages → gh-pages)
- 또는 로컬에서 `npm run deploy`
- 공개 주소(예): `https://aebonlee.github.io/project01/`

## 팁
- 화면·기능은 AI(바이브코딩)에게 자연어로 요청해 빠르게 만들어 보세요. (`CLAUDE.md` 참고)
