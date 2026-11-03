import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LESSONS, type Lesson } from '@sq/coach';
import {
  EXAM_MINI_SIZE,
  EXAM_SIZE,
  ExamResultResponseSchema,
  ExamStartResponseSchema,
  ExamsResponseSchema,
  type ExamStartResponse,
} from '@sq/shared';
import { ExamService } from '../src/exams/service.js';
import { LessonService } from '../src/lessons/service.js';
import { GameStore } from '../src/persistence/db.js';
import { skillOfLesson } from '../src/coach/learning.js';
import { testServer } from './client.js';

/** Générateur déterministe (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function server() {
  const s = await testServer();
  await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  return s;
}

const lessonOf = (id: string) => LESSONS.find((l) => l.id === id) as Lesson;

describe('examens de palier : accès et liste', () => {
  it('exige un compte', async () => {
    const s = await testServer();
    expect((await s.http('GET', '/api/exams')).status).toBe(401);
    expect((await s.http('POST', '/api/exams/1/start', { kind: 'stage' })).status).toBe(401);
    expect(
      (await s.http('POST', '/api/exams/1/result', { kind: 'stage', correct: 20 })).status,
    ).toBe(401);
    await s.app.close();
  });

  it('liste les trois paliers', async () => {
    const s = await server();
    const res = await s.http('GET', '/api/exams');
    expect(res.status).toBe(200);
    const { exams } = ExamsResponseSchema.parse(res.json);
    expect(exams.map((e) => e.stage)).toEqual([1, 2, 3]);
    for (const e of exams) {
      expect(e).toMatchObject({ best: null, total: EXAM_SIZE, passed: false, miniPassed: false });
    }
    const enough = (stage: number) =>
      LESSONS.filter((l) => l.phase === stage && !l.id.startsWith('classique-')).reduce(
        (n, l) => n + Math.min(3, l.exercises.length),
        0,
      ) >= EXAM_SIZE;
    for (const e of exams) expect(e.available).toBe(enough(e.stage));
    await s.app.close();
  });
});

describe('examens de palier : composition', () => {
  it('tire 20 questions sans classique, au plus 3 par leçon, compétences variées', async () => {
    const s = await server();
    const res = await s.http('POST', '/api/exams/1/start', { kind: 'stage' });
    expect(res.status).toBe(200);
    const exam = ExamStartResponseSchema.parse(res.json);
    expect(exam).toMatchObject({ stage: 1, kind: 'stage' });
    expect(exam.questions).toHaveLength(EXAM_SIZE);
    const perLesson = new Map<string, number>();
    for (const q of exam.questions) {
      const lesson = lessonOf(q.lesson);
      expect(lesson.phase).toBe(1);
      expect(q.lesson.startsWith('classique-')).toBe(false);
      expect(q.skill).toBe(skillOfLesson(q.lesson));
      expect(q.exercise.fen).toBe(lesson.exercises[q.index]?.fen);
      perLesson.set(q.lesson, (perLesson.get(q.lesson) ?? 0) + 1);
    }
    expect(Math.max(...perLesson.values())).toBeLessThanOrEqual(3);
    expect(new Set(exam.questions.map((q) => q.skill)).size).toBeGreaterThanOrEqual(4);
    // Aucun doublon d'exercice.
    expect(new Set(exam.questions.map((q) => `${q.lesson}:${q.index}`)).size).toBe(EXAM_SIZE);
    await s.app.close();
  });

  it('mini-test : 5 questions tirées des finales fin-* du palier 1', async () => {
    const s = await server();
    const res = await s.http('POST', '/api/exams/1/start', { kind: 'mini' });
    expect(res.status).toBe(200);
    const exam = ExamStartResponseSchema.parse(res.json);
    expect(exam.questions).toHaveLength(EXAM_MINI_SIZE);
    for (const q of exam.questions) {
      expect(q.lesson.startsWith('fin-')).toBe(true);
      expect(lessonOf(q.lesson).phase).toBe(1);
    }
    // Pas de mini-test hors palier 1.
    expect((await s.http('POST', '/api/exams/2/start', { kind: 'mini' })).status).toBe(404);
    await s.app.close();
  });

  it('ne renvoie ni solution ni explication', async () => {
    const s = await server();
    const exam = (await s.http('POST', '/api/exams/1/start', { kind: 'stage' }))
      .json as ExamStartResponse;
    const text = JSON.stringify(exam);
    for (const q of exam.questions) {
      expect(Object.keys(q.exercise).sort()).toEqual(
        ['color', 'fen', 'hints', 'kind', 'legalMoves', 'prompt'].sort(),
      );
      const source = lessonOf(q.lesson).exercises[q.index];
      expect(text).not.toContain(source?.explanation ?? '§');
    }
    expect(text).not.toMatch(/"(solution|explanation|accepted|squares|traps|tolerance)":/);
    await s.app.close();
  });

  it('palier invalide ou type inconnu', async () => {
    const s = await server();
    for (const stage of ['0', '4', 'x', '1.5']) {
      expect((await s.http('POST', `/api/exams/${stage}/start`, { kind: 'stage' })).status).toBe(
        404,
      );
      expect(
        (await s.http('POST', `/api/exams/${stage}/result`, { kind: 'stage', correct: 3 })).status,
      ).toBe(404);
    }
    expect((await s.http('POST', '/api/exams/1/start', { kind: 'autre' })).status).toBe(400);
    expect((await s.http('POST', '/api/exams/1/result', { kind: 'stage' })).status).toBe(400);
    await s.app.close();
  });

  it('est déterministe avec un tirage injecté, et mélange les compétences', () => {
    const store = new GameStore(':memory:', { initialRating: 1200 });
    const lessons = new LessonService(store, () => Promise.resolve(null));
    const make = (seed: number) =>
      new ExamService(store, lessons, { random: seeded(seed) }).start(2, 'stage');
    expect(make(7)).toEqual(make(7));
    expect(make(7)).not.toEqual(make(8));
    expect(make(7)?.questions).toHaveLength(EXAM_SIZE);
    store.close();
  });

  it('refuse un palier sans assez d’exercices', () => {
    const store = new GameStore(':memory:', { initialRating: 1200 });
    const lessons = new LessonService(store, () => Promise.resolve(null));
    const few = LESSONS.filter((l) => l.phase === 1).slice(0, 2);
    const exams = new ExamService(store, lessons, { catalog: few });
    expect(exams.start(1, 'stage')).toBeNull();
    store.close();
  });
});

describe('examens de palier : résultats', () => {
  it('garde le meilleur score, seuil à 16/20', async () => {
    const s = await server();
    const post = async (kind: 'stage' | 'mini', correct: number) =>
      ExamResultResponseSchema.parse(
        (await s.http('POST', '/api/exams/1/result', { kind, correct })).json,
      );
    const failed = await post('stage', 15);
    expect(failed).toMatchObject({ passedNow: false, exam: { best: 15, passed: false } });
    // Un score plus faible ne remplace pas le meilleur.
    expect((await post('stage', 9)).exam.best).toBe(15);
    const passed = await post('stage', 16);
    expect(passed).toMatchObject({ passedNow: true, exam: { best: 16, passed: true } });
    // Déjà validé : ce n'est plus « maintenant ».
    expect(await post('stage', 20)).toMatchObject({ passedNow: false, exam: { best: 20 } });
    expect((await post('stage', 3)).exam).toMatchObject({ best: 20, passed: true });
    const listed = ExamsResponseSchema.parse((await s.http('GET', '/api/exams')).json);
    expect(listed.exams[0]).toMatchObject({ best: 20, passed: true });
    expect(listed.exams[1]).toMatchObject({ best: null, passed: false });
    await s.app.close();
  });

  it('borne le score à la taille de l’examen et valide le mini-test à 4/5', async () => {
    const s = await server();
    const mini3 = (await s.http('POST', '/api/exams/1/result', { kind: 'mini', correct: 3 }))
      .json as { exam: { miniPassed: boolean; best: number | null }; passedNow: boolean };
    expect(mini3.exam.miniPassed).toBe(false);
    expect(mini3.passedNow).toBe(false);
    const mini4 = (await s.http('POST', '/api/exams/1/result', { kind: 'mini', correct: 4 }))
      .json as typeof mini3;
    expect(mini4.exam.miniPassed).toBe(true);
    expect(mini4.passedNow).toBe(true);
    // Le mini-test n'altère pas le score de l'examen de palier.
    expect(mini4.exam.best).toBeNull();
    // Borne : 20 pour un mini-test est ramené à 5 (jamais de meilleur score aberrant).
    await s.http('POST', '/api/exams/1/result', { kind: 'mini', correct: 20 });
    expect(
      (await s.http('POST', '/api/exams/1/result', { kind: 'stage', correct: 21 })).status,
    ).toBe(400);
    // Pas de mini-test hors palier 1.
    expect((await s.http('POST', '/api/exams/2/result', { kind: 'mini', correct: 5 })).status).toBe(
      404,
    );
    await s.app.close();
  });

  it('la migration est idempotente et les résultats survivent à la réouverture', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exams-'));
    try {
      const path = join(dir, 'test.db');
      const first = new GameStore(path, { initialRating: 1200 });
      first.createUser({ id: 'u1', username: 'zoe', passwordHash: 'hash' });
      first.saveExamResult('u1', 2, 'stage', 17);
      first.close();
      const second = new GameStore(path, { initialRating: 1200 });
      expect(second.examBest('u1', 2, 'stage')).toBe(17);
      expect(second.examBest('u1', 2, 'mini')).toBeNull();
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
