import { createId, isValidId } from '../../core/ids.js';

export const MAX_CARDS = 1000;
export const MAX_CARD_TEXT_LENGTH = 2000;
export const MAX_CARD_TITLE_LENGTH = 120;

export function createCard(source = null) {
  return { id: createId(), title: source?.title ?? '', front: source?.front ?? '', back: source?.back ?? '' };
}

export function cardTitle(card, fallback = 'Untitled card') {
  return card.title?.trim() || fallback;
}

export function shuffledCardIds(cards) {
  const ids = cards.map((card) => card.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[other]] = [ids[other], ids[index]];
  }
  return ids;
}

export function validateCards(cards, ids) {
  if (!Array.isArray(cards) || cards.length > MAX_CARDS) {
    throw new Error(`A workspace supports up to ${MAX_CARDS} cards.`);
  }
  for (const card of cards) {
    if (!card || !isValidId(card.id) || ids.has(card.id) ||
        Object.keys(card).some((key) => !['id', 'title', 'front', 'back'].includes(key)) ||
        (card.title !== undefined && (typeof card.title !== 'string' || card.title.length > MAX_CARD_TITLE_LENGTH)) ||
        typeof card.front !== 'string' || typeof card.back !== 'string' ||
        card.front.length > MAX_CARD_TEXT_LENGTH || card.back.length > MAX_CARD_TEXT_LENGTH) {
      throw new Error(`Each card needs a unique ID, an optional title of at most ${MAX_CARD_TITLE_LENGTH} characters, and plain-text front and back of at most ${MAX_CARD_TEXT_LENGTH} characters each.`);
    }
    ids.add(card.id);
  }
}
