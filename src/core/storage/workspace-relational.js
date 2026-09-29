// Pure translation between the in-memory workspace contract and relational rows.
// This module deliberately knows nothing about SQLite, OPFS, Vue, or browser APIs.

function visitTree(items, parentId, visit) {
  items.forEach((item, sortOrder) => {
    visit(item, parentId, sortOrder);
    if (item.kind === 'group') visitTree(item.children, item.id, visit);
  });
}

export function workspaceToRows(workspace) {
  const notebook = workspace.features.notebook;
  const indexCards = workspace.features['index-cards'];
  const wordSearch = workspace.features['word-search'];

  const rows = {
    notebookState: {
      selection_present: Object.hasOwn(notebook, 'lastSelectedDocumentId') ? 1 : 0,
      last_selected_document_id: notebook.lastSelectedDocumentId ?? null,
    },
    notebookItems: [],
    notebookMarkdown: [],
    indexCardState: {
      selection_present: Object.hasOwn(indexCards, 'lastSelectedSetId') ? 1 : 0,
      last_selected_set_id: indexCards.lastSelectedSetId ?? null,
    },
    indexCardItems: [],
    indexCards: [],
    indexCardDisplay: Object.hasOwn(indexCards, 'display') ? {
      font: indexCards.display.font,
      text_size: indexCards.display.textSize,
      card_size: indexCards.display.cardSize,
      ink: indexCards.display.ink,
      baseline: indexCards.display.baseline,
    } : null,
    wordSearchItems: [],
    wordSearchDisplay: Object.hasOwn(wordSearch, 'display') ? {
      font: wordSearch.display.font,
      weight: Object.hasOwn(wordSearch.display, 'weight') ? wordSearch.display.weight : null,
      text_size: wordSearch.display.textSize,
      cell_size: wordSearch.display.cellSize,
      fit: wordSearch.display.fit,
      highlight: wordSearch.display.highlight,
      motion: wordSearch.display.motion,
    } : null,
    wordSearchPuzzles: [],
    wordSearchWords: [],
    wordSearchGames: [],
    wordSearchGameRows: [],
    wordSearchPlacements: [],
    wordSearchFound: [],
  };

  visitTree(notebook.items, null, (item, parentId, sortOrder) => {
    rows.notebookItems.push({
      id: item.id,
      parent_id: parentId,
      sort_order: sortOrder,
      kind: item.kind,
      name: item.name,
      document_type: item.kind === 'document' ? item.type : null,
    });
    if (item.kind === 'document' && item.type === 'markdown') {
      rows.notebookMarkdown.push({ item_id: item.id, markdown: item.data.markdown });
    }
  });

  visitTree(indexCards.items, null, (item, parentId, sortOrder) => {
    rows.indexCardItems.push({
      id: item.id,
      parent_id: parentId,
      sort_order: sortOrder,
      kind: item.kind,
      name: item.name,
    });
    if (item.kind === 'set') {
      item.cards.forEach((card, cardOrder) => rows.indexCards.push({
        id: card.id,
        set_id: item.id,
        sort_order: cardOrder,
        title: Object.hasOwn(card, 'title') ? card.title : null,
        back_title: Object.hasOwn(card, 'backTitle') ? card.backTitle : null,
        front: card.front,
        back: card.back,
      }));
    }
  });

  visitTree(wordSearch.items, null, (item, parentId, sortOrder) => {
    rows.wordSearchItems.push({
      id: item.id,
      parent_id: parentId,
      sort_order: sortOrder,
      kind: item.kind,
      name: item.name,
      board_rotation: item.kind === 'word-search' && Object.hasOwn(item, 'boardRotation')
        ? item.boardRotation
        : null,
    });
    if (item.kind !== 'word-search' || !Object.hasOwn(item, 'puzzle')) return;

    const puzzle = item.puzzle;
    const hintsPresent = Object.hasOwn(puzzle, 'hints');
    rows.wordSearchPuzzles.push({
      item_id: item.id,
      size: puzzle.size,
      difficulty: puzzle.difficulty,
      instructions: puzzle.instructions,
      study_mode: Object.hasOwn(puzzle, 'studyMode') ? puzzle.studyMode : null,
      hints_present: hintsPresent ? 1 : 0,
    });
    puzzle.words.forEach((word, wordOrder) => rows.wordSearchWords.push({
      item_id: item.id,
      word,
      sort_order: wordOrder,
      hint: hintsPresent && Object.hasOwn(puzzle.hints, word) ? puzzle.hints[word] : null,
    }));

    if (!Object.hasOwn(item, 'game')) return;
    rows.wordSearchGames.push({ item_id: item.id });
    item.game.rows.forEach((letters, rowIndex) => rows.wordSearchGameRows.push({
      item_id: item.id,
      row_index: rowIndex,
      letters,
    }));
    item.game.placements.forEach((placement, placementOrder) => rows.wordSearchPlacements.push({
      item_id: item.id,
      word: placement.word,
      sort_order: placementOrder,
      start_cell: placement.start,
      end_cell: placement.end,
    }));
    item.game.found.forEach((found, foundOrder) => rows.wordSearchFound.push({
      item_id: item.id,
      word: found.word,
      sort_order: foundOrder,
      start_cell: found.start,
      end_cell: found.end,
    }));
  });

  return rows;
}

function buildTree(itemRows, createNode) {
  const nodes = new Map(itemRows.map((row) => [row.id, createNode(row)]));
  const order = new Map(itemRows.map((row) => [row.id, row.sort_order]));
  const roots = [];

  for (const row of itemRows) {
    const node = nodes.get(row.id);
    if (row.parent_id === null) roots.push(node);
    else nodes.get(row.parent_id).children.push(node);
  }

  function sort(items) {
    items.sort((left, right) => order.get(left.id) - order.get(right.id));
    for (const item of items) if (item.kind === 'group') sort(item.children);
  }
  sort(roots);
  return { roots, nodes };
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

export function rowsToWorkspace(rows) {
  const markdownByItem = new Map(rows.notebookMarkdown.map((row) => [row.item_id, row.markdown]));
  const notebookTree = buildTree(rows.notebookItems, (row) => row.kind === 'group'
    ? { id: row.id, kind: 'group', name: row.name, children: [] }
    : {
      id: row.id,
      kind: 'document',
      name: row.name,
      type: row.document_type,
      data: row.document_type === 'markdown'
        ? { markdown: markdownByItem.get(row.id) ?? '' }
        : {},
    });

  const cardsBySet = groupBy(rows.indexCards, 'set_id');
  const indexTree = buildTree(rows.indexCardItems, (row) => row.kind === 'group'
    ? { id: row.id, kind: 'group', name: row.name, children: [] }
    : {
      id: row.id,
      kind: 'set',
      name: row.name,
      cards: (cardsBySet.get(row.id) ?? [])
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((card) => ({
          id: card.id,
          ...(card.title === null ? {} : { title: card.title }),
          ...(card.back_title === null ? {} : { backTitle: card.back_title }),
          front: card.front,
          back: card.back,
        })),
    });

  const puzzleByItem = new Map(rows.wordSearchPuzzles.map((row) => [row.item_id, row]));
  const wordsByItem = groupBy(rows.wordSearchWords, 'item_id');
  const gameItems = new Set(rows.wordSearchGames.map((row) => row.item_id));
  const gameRowsByItem = groupBy(rows.wordSearchGameRows, 'item_id');
  const placementsByItem = groupBy(rows.wordSearchPlacements, 'item_id');
  const foundByItem = groupBy(rows.wordSearchFound, 'item_id');

  const wordSearchTree = buildTree(rows.wordSearchItems, (row) => {
    if (row.kind === 'group') return { id: row.id, kind: 'group', name: row.name, children: [] };
    const item = {
      id: row.id,
      kind: 'word-search',
      name: row.name,
      ...(row.board_rotation === null ? {} : { boardRotation: row.board_rotation }),
    };
    const puzzleRow = puzzleByItem.get(row.id);
    if (!puzzleRow) return item;

    const wordRows = (wordsByItem.get(row.id) ?? [])
      .sort((left, right) => left.sort_order - right.sort_order);
    const puzzle = {
      words: wordRows.map((entry) => entry.word),
      size: puzzleRow.size,
      difficulty: puzzleRow.difficulty,
      instructions: puzzleRow.instructions,
    };
    if (puzzleRow.study_mode !== null) puzzle.studyMode = puzzleRow.study_mode;
    if (puzzleRow.hints_present) {
      puzzle.hints = {};
      for (const entry of wordRows) if (entry.hint !== null) puzzle.hints[entry.word] = entry.hint;
    }
    item.puzzle = puzzle;

    if (gameItems.has(row.id)) {
      item.game = {
        rows: (gameRowsByItem.get(row.id) ?? [])
          .sort((left, right) => left.row_index - right.row_index)
          .map((entry) => entry.letters),
        placements: (placementsByItem.get(row.id) ?? [])
          .sort((left, right) => left.sort_order - right.sort_order)
          .map((entry) => ({
            word: entry.word, start: entry.start_cell, end: entry.end_cell,
          })),
        found: (foundByItem.get(row.id) ?? [])
          .sort((left, right) => left.sort_order - right.sort_order)
          .map((entry) => ({
            word: entry.word, start: entry.start_cell, end: entry.end_cell,
          })),
      };
    }
    return item;
  });

  const notebook = { items: notebookTree.roots };
  if (rows.notebookState?.selection_present) {
    notebook.lastSelectedDocumentId = rows.notebookState.last_selected_document_id;
  }

  const indexCards = { items: indexTree.roots };
  if (rows.indexCardState?.selection_present) {
    indexCards.lastSelectedSetId = rows.indexCardState.last_selected_set_id;
  }
  if (rows.indexCardDisplay) {
    indexCards.display = {
      font: rows.indexCardDisplay.font,
      textSize: rows.indexCardDisplay.text_size,
      cardSize: rows.indexCardDisplay.card_size,
      ink: rows.indexCardDisplay.ink,
      baseline: rows.indexCardDisplay.baseline,
    };
  }

  const wordSearch = { items: wordSearchTree.roots };
  if (rows.wordSearchDisplay) {
    wordSearch.display = {
      font: rows.wordSearchDisplay.font,
      ...(rows.wordSearchDisplay.weight === null ? {} : { weight: rows.wordSearchDisplay.weight }),
      textSize: rows.wordSearchDisplay.text_size,
      cellSize: rows.wordSearchDisplay.cell_size,
      fit: rows.wordSearchDisplay.fit,
      highlight: rows.wordSearchDisplay.highlight,
      motion: rows.wordSearchDisplay.motion,
    };
  }

  return {
    format: 'dynamic-learner',
    version: 1,
    features: {
      notebook,
      'index-cards': indexCards,
      'word-search': wordSearch,
    },
  };
}
