import { levels, questions, letterSource } from './questions.js';
import { answerIsPresent, evaluate, maxByLevel, automaticMax, totalMax } from './scoring.js';

const byId = (id) => document.getElementById(id);
const totalQuestions = questions.length;
const storageKey = 'kapitanskaya-dochka-8-quiz-v1';
const answerLetters = ['А', 'Б', 'В', 'Г'];
const screens = ['welcome', 'quiz', 'results'];
const questionForm = byId('question-form');
const finishDialog = byId('finish-dialog');
const nextButton = byId('next');
const skipButton = byId('skip');
let attempt = loadAttempt();
let onlyMistakes = true;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function freshAttempt() {
  return {
    position: 0,
    started: false,
    completed: false,
    answers: questions.map(() => null),
    essayScores: questions.map(() => null),
  };
}

function storageUnavailable() {
  byId('storage-note').textContent = 'Прогресс доступен, пока открыта страница';
}

function loadAttempt() {
  const blank = freshAttempt();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.answers) || !Array.isArray(saved.essayScores)) return blank;
    return {
      position: Number.isInteger(saved.position) ? Math.max(0, Math.min(totalQuestions - 1, saved.position)) : 0,
      started: saved.started === true,
      completed: saved.completed === true,
      answers: questions.map(({ type, choices }, index) => {
        const value = saved.answers[index];
        if (type === 'choice') return Number.isInteger(value) && value >= 0 && value < choices.length ? value : null;
        return typeof value === 'string' ? value.slice(0, type === 'essay' ? 3000 : 260) : null;
      }),
      essayScores: questions.map(({ type, points }, index) => {
        const value = saved.essayScores[index];
        return type === 'essay' && Number.isInteger(value) && value >= 0 && value <= points ? value : null;
      }),
    };
  } catch {
    storageUnavailable();
    return blank;
  }
}

function saveAttempt() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    storageUnavailable();
  }
}

function showScreen(screen, heading, focus = true) {
  screens.forEach((id) => { byId(id).hidden = id !== screen; });
  document.body.dataset.screen = screen;
  window.scrollTo(0, 0);
  if (focus) byId(heading).focus({ preventScroll: true });
}

function showWelcome() {
  let label = 'Начать тест';
  if (attempt.completed) label = 'Открыть результат';
  else if (attempt.started) label = 'Продолжить тест';
  byId('start-label').textContent = label;
  showScreen('welcome', 'welcome-title');
}

function updateProgress() {
  const answered = attempt.answers.filter(answerIsPresent).length;
  const answeredHere = answerIsPresent(attempt.answers[attempt.position]);
  byId('answered-count').textContent = `Выполнено ${answered} из ${totalQuestions}`;
  byId('progress').setAttribute('aria-valuenow', String(answered));
  byId('progress-fill').style.width = `${answered / totalQuestions * 100}%`;
  nextButton.disabled = !answeredHere;
  skipButton.hidden = answeredHere;
}

function choiceInputs(question, answer) {
  const fieldset = make('fieldset');
  fieldset.append(make('legend', 'visually-hidden', 'Варианты ответа'));
  const choices = make('div', 'choices');
  question.choices.forEach((choice, index) => {
    const label = make('label', 'choice');
    const input = make('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(index);
    input.checked = index === answer;
    const box = make('span', 'choice-label');
    const letter = make('span', 'choice-letter', answerLetters[index]);
    letter.setAttribute('aria-hidden', 'true');
    box.append(letter, make('span', '', choice));
    label.append(input, box);
    choices.append(label);
  });
  fieldset.append(choices);
  return fieldset;
}

function textInput(question, answer) {
  const multiline = question.type === 'essay';
  const input = make(multiline ? 'textarea' : 'input', 'answer-input');
  if (multiline) input.rows = 6;
  else input.type = 'text';
  input.name = 'answer';
  input.value = answer ?? '';
  input.maxLength = multiline ? 3000 : 260;
  input.placeholder = multiline ? 'Напиши развёрнутый ответ…' : 'Введи ответ…';
  input.setAttribute('aria-label', multiline ? 'Развёрнутый ответ' : 'Краткий ответ');
  input.setAttribute('aria-describedby', multiline ? 'answer-note question-guide' : 'answer-note');
  return input;
}

function showQuestion(focus = true) {
  const question = questions[attempt.position];
  const answer = attempt.answers[attempt.position];
  const last = attempt.position === totalQuestions - 1;
  byId('step-count').textContent = `Задание ${attempt.position + 1} из ${totalQuestions}`;
  byId('level-tag').textContent = `Уровень ${question.numeral} · ${question.difficulty}`;
  byId('point-tag').textContent = ['1 балл', '2 балла', 'До 5 баллов'][question.levelIndex];
  byId('question-title').textContent = question.prompt;
  byId('answer-note').textContent = question.instruction;
  byId('question-guide').textContent = question.guide ?? '';
  byId('question-guide').hidden = !question.guide;
  byId('answer-area').replaceChildren(question.type === 'choice'
    ? choiceInputs(question, answer)
    : textInput(question, answer));
  byId('next-label').textContent = last ? 'Завершить' : 'Далее';
  skipButton.textContent = last ? 'Пропустить и завершить' : 'Пропустить';

  Array.from(byId('level-tabs').children).forEach((tab, index) => {
    if (index === question.levelIndex) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
  });
  byId('chapter-card').dataset.level = String(question.levelIndex);
  byId('chapter-marker').textContent = question.numeral;
  byId('chapter-difficulty').textContent = `${question.difficulty} уровень`;
  byId('chapter-title').textContent = question.name;
  byId('chapter-description').textContent = question.description;
  const art = `./${question.art}.webp`;
  if (byId('chapter-art').getAttribute('src') !== art) byId('chapter-art').src = art;
  updateProgress();
  showScreen('quiz', 'question-title', focus);
}

function completeAttempt() {
  if (finishDialog.open) finishDialog.close();
  attempt.completed = true;
  saveAttempt();
  showResults();
}

function missingQuestions() {
  return attempt.answers.map((answer, index) => answerIsPresent(answer) ? -1 : index).filter((index) => index >= 0);
}

function advance() {
  if (attempt.position < totalQuestions - 1) {
    attempt.position += 1;
    saveAttempt();
    showQuestion();
    return;
  }

  const missing = missingQuestions();
  if (!missing.length) {
    completeAttempt();
    return;
  }
  byId('finish-note').textContent = `Пропущено ${missing.length} из ${totalQuestions} заданий. За пропуски начисляется 0 баллов.`;
  finishDialog.showModal();
}

function answerRow(label, value, extraClass = '') {
  const row = make('p', extraClass);
  row.append(make('strong', '', label), document.createTextNode(' ' + value));
  return row;
}

function sourceLink(source) {
  const link = make('a', 'source-link', source.label);
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function sourceList(sources) {
  const list = make('div', 'sources');
  sources.forEach((source) => {
    const item = make('div', 'citation');
    if (source.quote) item.append(make('blockquote', '', `«${source.quote}»`));
    item.append(sourceLink(source));
    list.append(item);
  });
  return list;
}

function answerText({ question, status, answer }) {
  if (status === 'skipped') return 'Пропущено';
  return question.type === 'choice' ? question.choices[answer] : answer.trim();
}

function expectedText(question) {
  return question.type === 'choice' ? question.choices[question.correct] : question.correct;
}

function answerDetails(row, className, badgeClass, badgeText) {
  const card = make('details', `paper ${className}`);
  const summary = make('summary', 'answer-summary');
  const badge = make('span', `badge ${badgeClass}`, badgeText);
  summary.append(make('span', 'number', String(row.index + 1).padStart(2, '0')), make('span', 'prompt', row.question.prompt), badge);
  const details = make('div', 'answer-details');
  details.append(answerRow('Твой ответ —', answerText(row), 'response-text'));
  card.append(summary, details);
  return { card, details, badge };
}

function renderReview(score) {
  const items = score.rows.filter((row) => row.question.type !== 'essay' && (!onlyMistakes || row.status !== 'correct'));
  const cards = items.map((row, index) => {
    const correct = row.status === 'correct';
    const badge = row.status === 'skipped' ? 'Пропуск' : `${row.points} / ${row.question.points}`;
    const { card, details } = answerDetails(row, 'review-item', correct ? 'correct' : 'error', badge);
    details.append(
      answerRow('Правильный ответ —', expectedText(row.question)),
      make('p', '', row.question.explanation),
      sourceList(row.question.sources),
    );
    card.open = onlyMistakes && index === 0;
    return card;
  });
  if (!cards.length) cards.push(make('p', 'paper review-empty', 'Все ответы на первых двух уровнях верны.'));
  byId('review-list').replaceChildren(...cards);
  byId('filter-mistakes').setAttribute('aria-pressed', String(onlyMistakes));
  byId('filter-all').setAttribute('aria-pressed', String(!onlyMistakes));
  byId('mistake-count').textContent = `Ошибки — ${score.mistakes} · Пропуски — ${score.skipped}`;
}

function scoreOptions(row, onScore) {
  const fieldset = make('fieldset', 'score-fieldset');
  fieldset.append(make('legend', '', 'Моя оценка за ответ'));
  const options = make('div', 'score-options');
  for (let value = 0; value <= row.question.points; value += 1) {
    const label = make('label');
    const input = make('input');
    input.type = 'radio';
    input.name = `essay-score-${row.index}`;
    input.value = String(value);
    input.checked = attempt.essayScores[row.index] === value;
    input.setAttribute('aria-label', `${value} из ${row.question.points} баллов`);
    input.addEventListener('change', () => onScore(value));
    label.append(input, make('span', '', String(value)));
    options.append(label);
  }
  fieldset.append(options);
  return fieldset;
}

function renderEssays(score) {
  const essays = score.rows.filter((row) => row.question.type === 'essay');
  byId('essay-list').replaceChildren(...essays.map((row) => {
    let badgeClass = 'pending';
    let badgeText = 'Оцени ответ';
    if (row.status === 'skipped') {
      badgeClass = 'error';
      badgeText = 'Пропуск · 0 / 5';
    } else if (row.status === 'assessed') {
      badgeClass = 'correct';
      badgeText = `${row.points} / ${row.question.points}`;
    }
    const { card, details, badge } = answerDetails(row, 'essay-item', badgeClass, badgeText);
    details.append(answerRow('Пример ответа.', row.question.example, 'answer-sample'));
    if (row.status !== 'skipped') {
      const rubric = make('div', 'score-rubric');
      const criteria = make('ol');
      row.question.criteria.forEach((item) => criteria.append(make('li', '', item)));
      rubric.append(make('strong', '', 'Критерии самопроверки'), criteria);
      const options = scoreOptions(row, (value) => {
        attempt.essayScores[row.index] = value;
        saveAttempt();
        badge.className = 'badge correct';
        badge.textContent = `${value} / ${row.question.points}`;
        updateResultScore(evaluate(attempt.answers, attempt.essayScores));
        clearCopyState();
      });
      details.append(rubric, options);
    }
    details.append(sourceList(row.question.sources));
    return card;
  }));
}

function updateResultScore(score) {
  const automatic = score.byLevel[0] + score.byLevel[1];
  byId('score-label').textContent = score.pending ? 'Автоматическая проверка' : 'Всего баллов';
  byId('score-value').textContent = String(score.pending ? automatic : score.total);
  byId('score-max').textContent = `/ ${score.pending ? automaticMax : totalMax}`;
  byId('score-caption').textContent = score.pending
    ? `Осталось оценить задания уровня III — ${score.pending}`
    : `Оценка «${score.grade}» по шкале теста`;
  const labels = ['I. Выбор ответа', 'II. Краткий ответ', 'III. Самооценка'];
  byId('score-lines').replaceChildren(...score.byLevel.map((points, index) => {
    const row = make('div');
    row.append(make('dt', '', labels[index]), make('dd', '', `${points} / ${maxByLevel[index]}`));
    return row;
  }));

  const description = byId('result-description');
  if (score.pending) {
    const jump = make('a', '', 'развёрнутые ответы');
    jump.href = '#essays';
    description.replaceChildren('Автоматическая проверка завершена. Оцени ', jump, ' по критериям, чтобы узнать общий балл.');
  } else {
    description.textContent = 'Посмотри разбор ошибок и скопируй итог, чтобы отправить его учителю.';
  }
}

function clearCopyState() {
  byId('copy-status').textContent = '';
  byId('copy-text').hidden = true;
}

function showResults(focus = true) {
  const score = evaluate(attempt.answers, attempt.essayScores);
  onlyMistakes = true;
  updateResultScore(score);
  renderEssays(score);
  renderReview(score);
  clearCopyState();
  byId('letter-quote').textContent = `«${letterSource.quote}»`;
  byId('letter-link').textContent = letterSource.label;
  byId('letter-link').href = letterSource.url;
  showScreen('results', 'results-title', focus);
}

function makeReport(score) {
  const lines = ['Тест по повести «Капитанская дочка» · 8 класс'];
  const name = byId('student-name').value.trim();
  if (name) lines.push(`Имя и фамилия — ${name}`);
  const automatic = score.byLevel[0] + score.byLevel[1];
  lines.push('', score.pending
    ? `Автоматическая проверка — ${automatic} из ${automaticMax} баллов. Общий балл после проверки развёрнутых ответов.`
    : `Итог — ${score.total} из ${totalMax} баллов. Оценка «${score.grade}».`);
  levels.forEach((level, index) => {
    const note = index === 2 ? ' (самооценка)' : '';
    lines.push(`Уровень ${level.numeral} — ${score.byLevel[index]} из ${maxByLevel[index]}${note}.`);
  });
  lines.push('', `Ошибки — ${score.mistakes} · Пропуски — ${score.skipped} (уровни I и II)`);
  score.rows.filter((row) => row.question.type !== 'essay' && row.status !== 'correct').forEach((row) => {
    lines.push(`№${row.index + 1}. ${row.question.prompt}`, `Ответ — ${answerText(row)}`, `Правильно — ${expectedText(row.question)}`);
  });
  lines.push('', 'Развёрнутые ответы');
  score.rows.filter((row) => row.question.type === 'essay').forEach((row) => {
    const points = row.status === 'pending' ? 'ожидает проверки' : `${row.points} из ${row.question.points} баллов`;
    lines.push(`№${row.index + 1}. ${row.question.prompt}`, `${answerText(row)}`, `Баллы — ${points}`, '');
  });
  return lines.join('\n').trim();
}

byId('home').addEventListener('click', showWelcome);
byId('start').addEventListener('click', () => {
  if (attempt.completed) {
    showResults();
    return;
  }
  attempt.started = true;
  saveAttempt();
  showQuestion();
});

byId('back').addEventListener('click', () => {
  if (attempt.position === 0) {
    showWelcome();
    return;
  }
  attempt.position -= 1;
  saveAttempt();
  showQuestion();
});

questionForm.addEventListener('input', ({ target }) => {
  if (target.name !== 'answer') return;
  attempt.answers[attempt.position] = target.type === 'radio' ? Number(target.value) : target.value;
  saveAttempt();
  updateProgress();
});

questionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (answerIsPresent(attempt.answers[attempt.position])) advance();
});
skipButton.addEventListener('click', advance);

byId('go-to-unanswered').addEventListener('click', () => {
  finishDialog.close();
  attempt.position = missingQuestions()[0];
  saveAttempt();
  showQuestion();
});
byId('finish-now').addEventListener('click', completeAttempt);

byId('filter-mistakes').addEventListener('click', () => {
  onlyMistakes = true;
  renderReview(evaluate(attempt.answers, attempt.essayScores));
});
byId('filter-all').addEventListener('click', () => {
  onlyMistakes = false;
  renderReview(evaluate(attempt.answers, attempt.essayScores));
});

byId('student-name').addEventListener('input', clearCopyState);
byId('copy-result').addEventListener('click', async () => {
  const text = makeReport(evaluate(attempt.answers, attempt.essayScores));
  clearCopyState();
  try {
    await navigator.clipboard.writeText(text);
    byId('copy-status').textContent = 'Итог скопирован. Вставь его в сообщение учителю.';
  } catch {
    const field = byId('copy-text');
    field.value = text;
    field.hidden = false;
    field.focus();
    field.select();
    byId('copy-status').textContent = 'Скопируй выделенный текст из поля ниже.';
  }
});
byId('restart').addEventListener('click', () => {
  if (!window.confirm('Начать заново? Ответы этой попытки будут удалены из браузера.')) return;
  attempt = freshAttempt();
  byId('student-name').value = '';
  saveAttempt();
  showWelcome();
});

if (attempt.completed) showResults(false);
else if (attempt.started) showQuestion(false);
