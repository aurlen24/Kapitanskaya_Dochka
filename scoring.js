import { questions, levels } from './questions.js';

export const maxByLevel = levels.map(({ count, points }) => count * points);
export const automaticMax = maxByLevel[0] + maxByLevel[1];
export const totalMax = automaticMax + maxByLevel[2];

export function answerIsPresent(answer) {
  return Number.isInteger(answer) || (typeof answer === 'string' && answer.trim() !== '');
}

function normalize(answer) {
  return answer.toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[^а-я0-9]+/g, ' ')
    .trim()
    .replace(/^(?:ответ|автор|жанр|это|имя автора|крепость называлась) +(?:это +)?/, '');
}

export function evaluate(answers, essayScores) {
  const byLevel = levels.map(() => 0);
  let pending = 0;
  let mistakes = 0;
  let skipped = 0;
  const rows = questions.map((question, index) => {
    const answer = answers[index];
    let status = 'skipped';
    let points = 0;
    if (!answerIsPresent(answer)) {
      if (question.type !== 'essay') skipped += 1;
    } else if (question.type === 'essay') {
      const manual = essayScores[index];
      status = manual === null ? 'pending' : 'assessed';
      if (status === 'pending') pending += 1;
      else points = manual;
    } else {
      const correct = question.type === 'choice'
        ? answer === question.correct
        : question.accepted.test(normalize(answer));
      status = correct ? 'correct' : 'wrong';
      if (correct) points = question.points;
      else mistakes += 1;
    }
    byLevel[question.levelIndex] += points;
    return { question, index, answer, points, status };
  });

  const total = byLevel.reduce((sum, points) => sum + points, 0);
  let grade = 2;
  if (total >= 27) grade = 5;
  else if (total >= 21) grade = 4;
  else if (total >= 15) grade = 3;

  return { rows, byLevel, total, grade, pending, mistakes, skipped };
}
