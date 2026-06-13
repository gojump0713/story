/**
 * 브라우저 음성 합성(Web Speech API) 훅 — 동화 읽어주기.
 * 키·서버 불필요. 한국어 음성을 우선 선택하고, 속도 조절·일시정지·연속 재생을 지원한다.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
export const ttsSupported = !!synth;

/** ko-KR 음성을 우선 고르되, 없으면 첫 음성 */
function pickKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((v) => v.lang === 'ko-KR') || voices.find((v) => v.lang.startsWith('ko')) || voices[0];
}

export interface ReadAloud {
  supported: boolean;
  speaking: boolean;
  current: number;           // 현재 읽고 있는 문단 인덱스(-1: 없음)
  rate: number;
  setRate: (r: number) => void;
  play: (parts: string[], from?: number) => void;  // 여러 문단을 순서대로 읽기
  stop: () => void;
}

export function useReadAloud(): ReadAloud {
  const [speaking, setSpeaking] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [rate, setRate] = useState(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();
  const cancelled = useRef(false);

  useEffect(() => {
    if (!synth) return;
    const load = () => setVoice(pickKoreanVoice(synth.getVoices()));
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      synth.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    synth?.cancel();
    setSpeaking(false);
    setCurrent(-1);
  }, []);

  const play = useCallback((parts: string[], from = 0) => {
    if (!synth) return;
    synth.cancel();
    cancelled.current = false;
    setSpeaking(true);
    let i = from;
    const speakNext = () => {
      if (cancelled.current || i >= parts.length) { setSpeaking(false); setCurrent(-1); return; }
      const u = new SpeechSynthesisUtterance(parts[i]);
      u.lang = 'ko-KR';
      u.rate = rate;
      if (voice) u.voice = voice;
      setCurrent(i);
      u.onend = () => { i += 1; speakNext(); };
      u.onerror = () => { setSpeaking(false); setCurrent(-1); };
      synth.speak(u);
    };
    speakNext();
  }, [rate, voice]);

  return { supported: ttsSupported, speaking, current, rate, setRate, play, stop };
}
