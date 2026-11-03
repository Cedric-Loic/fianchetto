import { useEffect, useState } from 'react';
import type { CurriculumResponse, DailySession, SkillLevel } from '@sq/shared';
import { api } from './api';

/** Données du plan pédagogique, chargées à la demande (rien n'est coché côté client). */
export function useCoachPlan(
  enabled: boolean,
  want: { session?: boolean; skills?: boolean; curriculum?: boolean; due?: boolean },
) {
  const [session, setSession] = useState<DailySession | null>(null);
  const [skills, setSkills] = useState<SkillLevel[] | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumResponse | null>(null);
  const [due, setDue] = useState<number | null>(null);
  const { session: wSession, skills: wSkills, curriculum: wCurriculum, due: wDue } = want;

  useEffect(() => {
    if (!enabled) return;
    const load = () => {
      if (wSession) void api.coachSession().then((r) => r && setSession(r.session));
      if (wSkills) void api.coachSkills().then((r) => r && setSkills(r.skills));
      if (wCurriculum) void api.coachCurriculum().then((r) => r && setCurriculum(r));
      if (wDue) void api.reviewCards().then((r) => r && setDue(r.due.length));
    };
    load();
    // Retour sur l'onglet : l'état est redemandé au serveur.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, wSession, wSkills, wCurriculum, wDue]);

  return { session, setSession, skills, curriculum, due };
}
