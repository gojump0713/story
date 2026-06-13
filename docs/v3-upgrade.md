# project01 — v3 고도화 노트 (AI 동화책 제작 스튜디오)

> 2026-06-05 · 기존 "주제 선택→4장면 생성" 앱을 그림책 제작 스튜디오로 고도화

## 지능화
- **단일 JSON 호출**로 제목·헌사·장면·교훈·어휘·부모질문을 한 번에 생성 (`response_format=json_object`)
- **연령대(3~5/6~8/9~11세)별 어휘 난이도 조절**, 분위기(잔잔/모험/유쾌/감동), 길이(4/6/8장면), 함께하는 친구 입력
- **DALL·E 3 삽화**(선택) — 장면별 실사 삽화 생성, 실패 시 SVG 폴백

## 인터랙션 / 디자인
- **TTS 음성 낭독**(Web Speech API, ko-KR) — 장면별·전체 재생, 속도 조절, 현재 장면 하이라이트 (키 불필요)
- **생성형 SVG 삽화** — 배경별(숲/바다/한옥/산/밤하늘/정원) 그림책 일러스트를 코드로 렌더
- **그림책 UI** — 표지(제목·헌사·통계) + 세리프 본문 + 어휘 카드 + 부모 질문 + 교훈 콜아웃
- **책장** 표지 썸네일 저장/재열람, **텍스트 복사·인쇄(@media print 종이 동화책)**

## 콘텐츠
- Info 탭에 **AI 처리 파이프라인(6단계)**, **기술 설계 노트 4종**, 도메인 가이드 확장

## 파일
- `src/App.tsx` — 스튜디오 폼 + StoryView(그림책) + 책장
- `src/lib/ai.ts` — `generateImage()`(DALL·E) 추가
- `src/lib/tts.ts` — `useReadAloud` 음성 낭독 훅 (신규)
- `src/lib/scene-art.tsx` — 배경별 생성형 SVG 컴포넌트 (신규)
- `src/ui.tsx` — Meta에 `pipeline`/`techNotes` 추가, InfoTab 렌더 확장
- `src/index.css` — studio/book/scene/shelf/print 스타일 추가

## 스택
React 18 · TypeScript · Vite · OpenAI GPT · DALL·E 3 · Web Speech API · SVG · localStorage

---

## v4 (2026-06-05) — 기획서(sample.dreamitbiz.com) 사양으로 멀티페이지 고도화
sample.dreamitbiz.com의 "쉬었음 청년 프로젝트" 기획서 6단계 파이프라인·멀티페이지 흐름에 맞춰 정적 React로 구현 수준을 끌어올림.
- **멀티페이지 흐름**: 입력(create) → 생성 진행(generating) → 페이지 넘기기 뷰어(reader) → 독후활동(activity) → 책장(library)
- **6단계 생성 파이프라인 애니메이션**: 소재분석→스토리→장면분할→삽화→독후활동→렌더링 상태기계 시각화
- **페이지 넘기기 뷰어**: 장면별 감정 그라데이션 + 이모지/DALL·E 삽화 + 이전/다음/도트 + TTS
- **독후활동 4종**: 생각 질문·창작 활동·만들기·어휘 (기획서의 교육 모듈 반영)
- 연령별 어휘 조절(6세 이하 15자/이상 25자) 프롬프트, 책장 표지 저장
- 정적 한계상 Solar/RAG/pgvector는 OpenAI·단일호출·localStorage로 대체(확장 설계는 Info 탭 기술노트에 명시)
