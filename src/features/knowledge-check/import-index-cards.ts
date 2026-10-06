import type { Card, CardSide } from '../index-cards/card-model.ts';
import type { CardSet, LibraryItem as IndexCardLibraryItem } from '../index-cards/tree-model.ts';
import { DEFAULT_SET_MODE, type SetModeId } from '../index-cards/set-modes.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { createQuestion, MAX_QUESTIONS, MAX_TEXT, type Question } from './question-model.ts';

export type IndexCardImportMapping = 'front-to-back' | 'back-to-front' | 'preserve-blanks';

export function findIndexCardSet(items: IndexCardLibraryItem[], id: string): CardSet | null {
  for (const item of items) {
    if (item.kind === 'set' && item.id === id) return item;
    if (item.kind === 'group') {
      const found = findIndexCardSet(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function indexCardMappings(set: CardSet | null): readonly { id: IndexCardImportMapping; label: string; description: string }[] {
  if ((set?.mode ?? DEFAULT_SET_MODE) === 'fill-in-the-blanks') {
    return [{
      id: 'preserve-blanks',
      label: 'Preserve Fill in the Blanks',
      description: 'Keep each card as one native Review Fill in the Blanks question with the same authored blanks.',
    }];
  }
  return [
    {
      id: 'front-to-back',
      label: 'Front → back',
      description: 'Use each card front as the question and its back as the expected Short Answer.',
    },
    {
      id: 'back-to-front',
      label: 'Back → front',
      description: 'Reverse each card so its back becomes the question and its front becomes the expected Short Answer.',
    },
  ];
}

function sidePrompt(card: Card, side: CardSide): string {
  const title = (side === 'front' ? card.title : card.backTitle)?.trim() ?? '';
  const body = card[side].trim();
  if (!body) return title;
  const combined = [title, body].filter(Boolean).join('\n\n');
  return combined.length <= MAX_TEXT ? combined : body;
}

function optionalExplanation(title: string | undefined, body: string): string {
  const heading = title?.trim() ?? '';
  const text = body.trim();
  const combined = [heading, text].filter(Boolean).join('\n\n');
  if (combined.length <= MAX_TEXT) return combined;
  return text.length <= MAX_TEXT ? text : '';
}

function answerForSide(card: Card, side: CardSide): string {
  const body = card[side].trim();
  const title = (side === 'front' ? card.title : card.backTitle)?.trim() ?? '';
  return body || title;
}

function convertFlashCard(card: Card, mapping: IndexCardImportMapping): Question | null {
  const promptSide: CardSide = mapping === 'back-to-front' ? 'back' : 'front';
  const answerSide: CardSide = promptSide === 'front' ? 'back' : 'front';
  const prompt = sidePrompt(card, promptSide);
  const answer = answerForSide(card, answerSide);
  if (!prompt || !answer) return null;

  const question = createQuestion('short-answer');
  question.prompt = prompt;
  question.answer = answer;
  const answerTitle = (answerSide === 'front' ? card.title : card.backTitle)?.trim() ?? '';
  if (answerTitle && answerTitle !== answer) question.explanation = answerTitle;
  return question;
}

function convertFillBlankCard(card: Card): Question | null {
  if (!parseFillBlankTemplate(card.front).answers.length) return null;
  const question = createQuestion('fill-in-the-blanks');
  question.prompt = card.front.trim();
  question.explanation = optionalExplanation(card.backTitle, card.back);
  return question;
}

export function importIndexCardSet(set: CardSet, mapping: IndexCardImportMapping): Question[] {
  const mode = set.mode ?? DEFAULT_SET_MODE;
  if (mode === 'fill-in-the-blanks') {
    return set.cards.map(convertFillBlankCard).filter((question): question is Question => question !== null);
  }
  return set.cards
    .map((card) => convertFlashCard(card, mapping))
    .filter((question): question is Question => question !== null);
}

export function intermixQuestionGroups(groups: Question[][]): Question[] {
  const result: Question[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const question = group[index];
      if (question) result.push(question);
    }
  }
  return result;
}

export function shuffleQuestions(questions: Question[]): Question[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled;
}

export function importQuestionLimitProblem(count: number): string {
  return count > MAX_QUESTIONS ? `This import would create ${count} questions. Review knowledge sets support up to ${MAX_QUESTIONS}.` : '';
}
