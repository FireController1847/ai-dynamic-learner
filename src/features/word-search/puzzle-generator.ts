import { directionsFor, validateGame } from './game-model.ts';
import { validatePuzzle } from './puzzle-model.ts';
import type { Direction, Game, WordPlacement } from './game-model.ts';

function candidates(word: string, size: number, directions: readonly Direction[]): number[][] {
  const result: number[][] = [];
  for (const [dr, dc] of directions) {
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const endRow = row + dr * (word.length - 1);
        const endCol = col + dc * (word.length - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        result.push(Array.from({ length: word.length }, (_, i) => (row + dr * i) * size + col + dc * i));
      }
    }
  }
  return result;
}

// Bounded randomized packing: longer words first, favoring compatible intersections.
// Yield between attempts so dense/impossible setups keep the interface responsive.
export async function generatePuzzle(puzzle: unknown, signal?: AbortSignal): Promise<Game | null> {
  validatePuzzle(puzzle);
  const { size, words, difficulty } = puzzle;
  const options = new Map(words.map((word) => [word, candidates(word, size, directionsFor(difficulty))]));
  for (let attempt = 0; attempt < 48; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (signal?.aborted) return null;
    const cells: string[] = Array<string>(size * size).fill('');
    const placements: WordPlacement[] = [];
    const order = words.map((word) => ({ word, priority: word.length + Math.random() * 2 }))
      .sort((a, b) => b.priority - a.priority);
    for (const { word } of order) {
      let best: number[] | null = null;
      let bestScore = -Infinity;
      for (const path of options.get(word) ?? []) {
        let overlap = 0;
        let fits = true;
        for (let index = 0; index < path.length; index += 1) {
          if (cells[path[index]] && cells[path[index]] !== word[index]) { fits = false; break; }
          if (cells[path[index]]) overlap += 1;
        }
        if (!fits) continue;
        const score = overlap + Math.random() * (attempt % 3 === 0 ? 4 : 1);
        if (score > bestScore) { best = path; bestScore = score; }
      }
      if (!best) break;
      best.forEach((cell, index) => { cells[cell] = word[index]; });
      placements.push({ word, start: best[0], end: best[best.length - 1] });
    }
    if (placements.length !== words.length) continue;
    const letters = cells.map((letter) => letter || String.fromCharCode(65 + Math.floor(Math.random() * 26)));
    const game = {
      rows: Array.from({ length: size }, (_, row) => letters.slice(row * size, (row + 1) * size).join('')),
      placements, found: [],
    };
    validateGame(puzzle, game);
    return game;
  }
  throw new Error('These words could not all fit. Try again for a different arrangement, or edit the puzzle to use a larger grid or fewer words.');
}
