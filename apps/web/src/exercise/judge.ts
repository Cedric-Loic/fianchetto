import { api } from '../lib/api';
import type { ExerciseAnswer, ExerciseVerdict } from './ExercisePlayer';

/**
 * Jugement par le serveur d'une réponse à l'exercice `index` d'une leçon (coup ou cases). Les
 * examens de palier l'emploient aussi : leurs questions sont des exercices de leçons.
 */
export async function judgeLesson(
  lessonId: string,
  index: number,
  answer: ExerciseAnswer,
  hints: number,
): Promise<ExerciseVerdict | null> {
  if (answer.kind === 'move') {
    return api.lessonMove(lessonId, index, answer.step, answer.uci, hints);
  }
  if (answer.kind === 'squares') {
    return api.lessonSquares(lessonId, index, answer.squares, hints);
  }
  return null; // pas de QCM dans les leçons pour l'instant
}
