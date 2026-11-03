import { useEffect, useRef, useState } from 'react';
import type { CoachAnswerResponse, CoachPromptResponse, Square } from '@sq/shared';
import { api } from '../lib/api';

type Prompt = NonNullable<CoachPromptResponse['prompt']>;

export interface Coach {
  /** Question en cours pour la position affichée (réponse en attente ou corrigée). */
  prompt: Prompt | null;
  picked: Square[];
  result: CoachAnswerResponse | null;
  busy: boolean;
  /** Le joueur ne peut pas jouer tant que la question n'est pas close. */
  blocking: boolean;
  toggle: (square: Square) => void;
  validate: () => void;
  skip: () => void;
  next: () => void;
}

/**
 * Partie coachée : une seule requête par position (ply) quand c'est au joueur de jouer. Toute
 * erreur (réseau, 503, 404) est ignorée : la partie n'est jamais bloquée.
 */
export function useCoach(gameId: string, ply: number, eligible: boolean): Coach {
  const asked = useRef(new Set<string>());
  const [current, setCurrent] = useState<Prompt | null>(null);
  const [picked, setPicked] = useState<Square[]>([]);
  const [result, setResult] = useState<CoachAnswerResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    const set = asked.current;
    const key = `${gameId}:${ply}`;
    if (set.has(key)) return;
    set.add(key);
    let cancelled = false;
    let settled = false;
    void api.coachPrompt(gameId).then((res) => {
      settled = true;
      if (cancelled || !res?.prompt || res.prompt.ply !== ply) return;
      setPicked([]);
      setResult(null);
      setCurrent(res.prompt);
    });
    return () => {
      cancelled = true;
      // Position quittée avant la réponse : on pourra la redemander à son retour.
      if (!settled) set.delete(key);
    };
  }, [eligible, gameId, ply]);

  const prompt = eligible && current && current.ply === ply ? current : null;
  const close = () => {
    setCurrent(null);
    setPicked([]);
    setResult(null);
  };
  const answer = (squares: Square[]) => {
    if (!prompt || busy || result) return;
    setBusy(true);
    void api.coachAnswer(gameId, prompt.ply, squares).then((res) => {
      setBusy(false);
      if (res) setResult(res);
      else close(); // erreur serveur : on rend la main
    });
  };

  return {
    prompt,
    picked,
    result,
    busy,
    blocking: prompt !== null,
    toggle: (sq) => {
      if (!prompt || result || busy) return;
      setPicked((p) =>
        p.includes(sq) ? p.filter((x) => x !== sq) : p.length < 16 ? [...p, sq] : p,
      );
    },
    validate: () => answer(picked),
    skip: () => answer([]),
    next: close,
  };
}
