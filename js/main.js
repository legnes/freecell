// Freecell main.js

// Deck wrapper stuff ////////////////////////////////////////////////
Deck.empty = (deck) => {
  while (deck.cards.length > 0) {
    deck.cards.pop().unmount();
  }
  return deck;
};

Deck.createEmpty = (elt) => {
  const deck = Deck.empty(Deck());
  deck.mount(elt);
  return deck;
};

Deck.lastIdx = (deck) => (deck.cards.length - 1);

Deck.lastCard = (deck) => {
  return deck.cards[Deck.lastIdx(deck)];
};

Deck.deal = (fromDeck, toDeck) => {
  const card = fromDeck.cards.pop();
  card.unmount();
  Deck.addCard(toDeck, card);
};

Deck.dealCard = (fromDeck, toDeck, card, animate=false) => {
  const cardIndex = fromDeck.cards.indexOf(card);
  if (cardIndex < 0) return;

  const maxZ = toDeck.cards.reduce((max, card) => Math.max(max, Card.zIndex(card)), 0);
  card.$el.style.zIndex = Math.max(maxZ + 1, card.$el.style.zIndex);

  if (animate) {
    const fromPos = fromDeck.$el.getBoundingClientRect();
    const toPos = toDeck.$el.getBoundingClientRect();
    card.x = fromPos.x - toPos.x;
    card.y = fromPos.y - toPos.y;
  }

  fromDeck.cards.splice(cardIndex, 1);
  card.unmount();
  Deck.addCard(toDeck, card, 0, animate ? 100 : 0);
};

Deck.dealCards = (fromDeck, toDeck, startCard) => {
  if (!startCard) startCard = fromDeck.cards[0];
  const startIndex = fromDeck.cards.indexOf(startCard);
  if (startIndex < 0) return;
  const maxZ = toDeck.cards.reduce((max, card) => Math.max(max, Card.zIndex(card)), 0);

  const cards = fromDeck.cards.splice(startIndex);
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    card.unmount();
    card.$el.style.zIndex = maxZ + i + 1;
    Deck.addCard(toDeck, card);
  }
};

Deck.addCard = (deck, card, delay=0, duration=0) => {
  deck.cards.push(card);
  card.mount(deck.$el);
  card.deck = deck;
  card.animateTo({
    delay,
    duration,
    x: 0,
    y: deck.isSpreadable ? Deck.lastIdx(deck) * Card.fontSize() : 0,
  });
};

Deck.move = (deck, pos) => {
  deck.$el.parentElement.style.transform = `translate(
    ${pos.x + pos.width / 2}px,
    ${pos.y + pos.height / 2}px
  )`;
};

Deck.moveCards = (deck, dPos, idx) => {
  idx = idx || 0;
  for (let i = idx; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    card.$el.style.transform = `translate(${Math.round(card.x + dPos.x)}px, ${Math.round(card.y + dPos.y)}px)`;
  }
};

Deck.makeSpreadable = (deck) => {
  deck.isSpreadable = true;
  deck.spread = deck.queued(spread)

  function spread(next) {
    const len = deck.cards.length;
    deck.cards.forEach(function (card, i) {
      const delay = i * 10

      card.animateTo({
        // The base delay used to be set to 300, but it seemed like there was a race
        // where it may have been finishing before shuffle (~504ms), which then set the wrong zindex.
        // There's some extra complication because we are dealing while shuffling is onging...
        // Real solution here is probably to write our own shuffle logic with promises or cbs
        delay: 600 + delay,
        duration: 300,
        x: 0,
        y: i * Card.fontSize(),
        onStart: function () {
          card.$el.style.zIndex = i
        },
        onComplete: function () {
          if (i === len - 1) next();
        }
      });

    });
  }

  deck.respread = () => {
    deck.cards.forEach(function (card, i) {
      card.animateTo({
        delay: 0,
        duration: 0,
        x: 0,
        y: i * Card.fontSize(),
      });
    });
  }

  return deck;
};

Deck.forEachDeckXCard = (decks, fn) => decks.forEach((d) => d.cards.forEach((c, i) => fn(d, c, i)));

Deck.forEachDeckXCardReversed = (decks, fn) => decks.forEach((d) => {
  const cards = d.cards;
  for (let i = cards.length - 1; i >= 0; i--) {
    fn(d, cards[i], i);
  }
});

Deck.decksCardCount = (decks) => decks.reduce((sum, d) => (d.cards.length + sum), 0);

const Card = {};

Card.fontSize = () => window.getComputedStyle(document.body).getPropertyValue('font-size').slice(0, -2);

Card.zIndex = (card) => card.$el.style.zIndex;

Card.enableDragging = (card) => {
  card.enableDragging();
  card.isDraggable = true;
};

Card.disableDragging = (card) => {
  card.disableDragging();
  card.isDraggable = false;
};

Card.isValidStack = (prevCard, card) => (((prevCard.suit + card.suit) % 2) === 1 && prevCard.rank === card.rank + 1);

Card.isNextInSuit = (prevCard, card) => (prevCard.suit === card.suit && prevCard.rank === card.rank - 1);

const getEvtPosition = (evt) => {
  if (evt.type.includes('touch')) {
    evt = evt.touches[0] || evt.changedTouches[0];
  }
  return { x: evt.clientX, y: evt.clientY };
};

const subtractPositions = (a, b) => {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
};

// Context creation stuff ////////////////////////////////////////////////
const initGlobalHandlers = () => {
  const resetElt = document.getElementById('resetButton');
  document.addEventListener('mousemove', (evt) => {
    const { left, right } = resetElt.getBoundingClientRect();
    const fn = evt.clientX > (left + right) / 2 ? 'add' : 'remove';
    resetElt.classList[fn]("reflected");
  });
  resetElt.addEventListener('click', newGame);

  const undoElt = document.getElementById('undoButton');
  undoElt.addEventListener('click', undo);

  window.addEventListener('resize', () => {
    _state.board.cascades.forEach(deck => deck.respread());
  });
};

const initGlobalState = () => {
  const cellElts = document.getElementsByClassName('cell');
  const foundationElts = document.getElementsByClassName('foundation');
  const cascadeElts = document.getElementsByClassName('cascade');
  const dragDeck = document.getElementById('dragDeck');
  const winMessage = document.getElementById('winMessage');
  const undoButton = document.getElementById('undoButton');

  _state = {
    board: {
      cells: Array.from(cellElts).map(Deck.createEmpty),
      foundations: Array.from(foundationElts).map(Deck.createEmpty),
      cascades: Array.from(cascadeElts).map(Deck.createEmpty),
    },
    drag: {
      deck: Deck.makeSpreadable(Deck.createEmpty(dragDeck)),
      originDeck: null,
      startPos: null
    },
    ui: {
      winMessage,
      undoButton
    },
    undo: {
      originDeck: null,
      startCard: null
    }
  };
  _state.board.cascades.forEach(Deck.makeSpreadable);
  _state.board.allDecks = [
    ..._state.board.cascades,
    ..._state.board.foundations,
    ..._state.board.cells
  ];
  return _state;
};

// Game creation stuff ////////////////////////////////////////////////

const initCardHanlders = (() => {
  const dragCards = (evt) => {
    const dragDeck = _state.drag.deck;
    const botCard = dragDeck.cards[0];
    if (!botCard) return;
    const evtPos = getEvtPosition(evt);
    Deck.moveCards(dragDeck, subtractPositions(evtPos, _state.drag.startPos), 1);
  };

  const releaseCards = (evt) => {
    const dragDeck = _state.drag.deck;
    if (dragDeck.cards.length < 1) {
      // Update state just in case
      // Sometimes we disabled dragging to override underlying Card behavior
      updateState();
      return;
    }

    const originDeck = _state.drag.originDeck;
    _state.drag.originDeck = null;

    const evtPos = getEvtPosition(evt);
    let toDeck;
    let minDeckDistance = Infinity;
    _state.board.allDecks.forEach((deck) => {
      const deckPos = deck.$el.getBoundingClientRect();
      const deckDistance = Math.sqrt((evtPos.x - deckPos.x) * (evtPos.x - deckPos.x) + (evtPos.y - deckPos.y) * (evtPos.y - deckPos.y));
      if (deckDistance < minDeckDistance) {
        minDeckDistance = deckDistance;
        toDeck = deck;
      }
    });

    if (canDeckReceiveCards(toDeck, dragDeck.cards)) {
      // Update tableau state
      if (_state.board.cascades.includes(toDeck)) {
        dragDeck.cards.forEach((card) => { card.tableau = true; });
        if (toDeck.cards.length > 0) Deck.lastCard(toDeck).tableau = true;
      }
      const startCard = dragDeck.cards[0];
      Deck.dealCards(dragDeck, toDeck);
      updateUndoState(originDeck, startCard);
    } else {
      Deck.dealCards(dragDeck, originDeck);
    }
    updateState();
  };

  const grabCards = (card, evt) => {
    if (!card.isDraggable) return false;
    _state.drag.originDeck = card.deck;
    const pos = card.$el.getBoundingClientRect();
    Deck.move(_state.drag.deck, pos);
    Deck.dealCards(card.deck, _state.drag.deck, card);
    _state.drag.startPos = getEvtPosition(evt);
    return true;
  };

  const moveToFreeCell = (card) => {
    if (
      card !== Deck.lastCard(card.deck) ||
      _state.board.foundations.some(d => d.cards.includes(card)) ||
      _state.board.cells.some(d => d.cards.includes(card))
    ) {
      return false;
    }

    let freeCell;
    for (let i = 0; i < _state.board.cells.length; i++) {
      const cell = _state.board.cells[i];
      if (cell.cards.length < 1) {
        freeCell = cell;
        break;
      }
    }
    if (!freeCell) return false;

    const fromDeck = card.deck;
    Deck.deal(fromDeck, freeCell);
    updateUndoState(fromDeck, card);
    updateState();
    return true;
  };

  const reconcileClickEventFn = (card) => {
    // Manual double click logic..... :\
    let clicks = 0;
    let lastClick = Date.now();
    return (evt) => {
      let isDoubleClick = true;

      const dt = Date.now() - lastClick;
      lastClick = Date.now();
      if (++clicks < 2) {
        isDoubleClick = false;
      } else if (dt > 500) {
        clicks = 1;
        isDoubleClick = false;
      } else {
        clicks = 0;
        // isDoubleClick = true;
      }

      // Sometimes disable click and drag on the underlying card structure
      // else you can drag even after weve "released" the card into a new deck.
      // This overrides the update state in moveToFreeCell
      // and relies on updating state on mouse up
      if (evt.touches && evt.touches.length > 1) {
        releaseCards(evt);
        Card.disableDragging(card);
      } else if (isDoubleClick) {
        if (moveToFreeCell(card)) {
          Card.disableDragging(card);
        } else {
          grabCards(card, evt);
        }
      } else {
        grabCards(card, evt);
      }
    };
  };

  document.addEventListener('mousemove', dragCards);
  document.addEventListener('touchmove', dragCards);
  document.addEventListener('mouseup', releaseCards);
  document.addEventListener('touchend', releaseCards);
  return (deck) => {
    deck.cards.forEach((card) => {
      card.$el.addEventListener('mousedown', reconcileClickEventFn(card));
      card.$el.addEventListener('touchstart', reconcileClickEventFn(card));
    });
  }
})();

const newGame = () => {
  // First queue a test fn to make sure no decks are still animating
  for (let i = 0; i < _state.board.allDecks.length; i++) {
    const deck = _state.board.allDecks[i];
    let idle = true;
    deck.queue((cb) => { idle = false; cb(); });
    if (idle) return false;
  }
  // Then empty all the decks
  _state.board.allDecks.forEach(Deck.empty);

  updateUndoState(null, null);

  const dealDeck = Deck();
  initCardHanlders(dealDeck);
  dealDeck.shuffle();
  let i = 0;
  while (dealDeck.cards.length > 0) {
    Deck.deal(dealDeck, _state.board.cascades[i++ % _state.board.cascades.length]);
  }

  // Do these sequentially to use the queue system
  _state.board.cascades.forEach(d => d.spread());
  _state.board.cascades.forEach(d => d.flip());
  updateState();
};

// Game logic stuff ////////////////////////////////////////////////
const updateDragState = () => {
  Deck.forEachDeckXCard(_state.board.foundations, (_deck, card) => Card.disableDragging(card));
  Deck.forEachDeckXCard(_state.board.cells, (_deck, card) => {
    card.tableau = false;
    Card.enableDragging(card);
  });
  Deck.forEachDeckXCardReversed(_state.board.cascades, (deck, card, idx) => {
    if (idx === Deck.lastIdx(deck)) {
      card.tableau = true;
    } else {
      const nextCard = deck.cards[idx + 1];
      card.tableau = (card.tableau || (nextCard.tableau && Card.isValidStack(card, nextCard)));
    }

    const availableCellCount = _state.board.cells.reduce((num, cell) => (num - cell.cards.length), 4)
    const deckOffset = Deck.lastIdx(deck) - deck.cards.indexOf(card);

    if ((card.tableau && deckOffset <= availableCellCount)) {
      Card.enableDragging(card);
    } else {
      Card.disableDragging(card);
    }
  });
};

const updateWinState = () => {
  // All cards are in foundations
  const foundationCards = Deck.decksCardCount(_state.board.foundations);
  if (foundationCards >= 52) {
    _state.ui.winMessage.style.width = '';
    return;
  }

  // All cards could be in foundations
  const cascadeCards = Deck.decksCardCount(_state.board.cascades);
  const finishedCascadeCards = _state.board.cascades.reduce((sum, deck) =>
    (sum + deck.cards.reduce((deckSum, card, idx) => {
      if (idx === 0) return (deckSum + 1);
      const prevCard = deck.cards[idx - 1];
      return deckSum + (Card.isValidStack(prevCard, card) ? 1 : 0);
    }, 0)),
  0);
  if (finishedCascadeCards === cascadeCards) {
    updateUndoState(null, null);
    for (let i = 0; i < _state.board.allDecks.length; i++) {
      const deck = _state.board.allDecks[i];
      const card = Deck.lastCard(deck);
      if (!card || _state.board.foundations.includes(deck)) {
        continue;
      }
      for (let j = 0; j < _state.board.foundations.length; j++) {
        const foundation = _state.board.foundations[j];
        const prevCard = Deck.lastCard(foundation);
        if ((!prevCard && card.rank === 1) || Card.isNextInSuit(prevCard, card)) {
          Deck.dealCard(deck, foundation, card, true);
          return setTimeout(updateState, 60);
        }
      }
    }
  }

  // Not won
  _state.ui.winMessage.style.width = '0';
};

const updateUndoState = (originDeck, startCard) => {
  _state.undo.originDeck = originDeck;
  _state.undo.startCard = startCard;
  _state.ui.undoButton.disabled = !(originDeck && startCard);
}

const undo = () => {
  const { originDeck, startCard } = _state.undo;
  updateUndoState(null, null);
  if (originDeck && startCard) {
    Deck.dealCards(startCard.deck, originDeck, startCard);
    updateState();
  }
}

const canDeckReceiveCards = (deck, cards) => {
  const botCard = cards[0];
  if (_state.board.cells.includes(deck)) {
    if (cards.length > 1) return false;
    return deck.cards.length < 1;
  }

  if (_state.board.foundations.includes(deck)) {
    if (cards.length > 1) return false;
    const prevCard = Deck.lastCard(deck);
    if (!prevCard) return botCard.rank === 1;
    return Card.isNextInSuit(prevCard, botCard);
  }

  if (_state.board.cascades.includes(deck)) {
    const prevCard = Deck.lastCard(deck);
    if (!prevCard) return true;
    return Card.isValidStack(prevCard, botCard);
  }
};

const updateState = () => {
  updateDragState();
  updateWinState();
};

// Main ////////////////////////////////////////////////
let _state;
initGlobalState(); // TODO: Pass state around? closure everything?
initGlobalHandlers();
newGame();

// TODO:
//  [ ] improve card follow when zoomed in
//  [ ] prevent copy/paste cards?
//  [ ] clean up lol
