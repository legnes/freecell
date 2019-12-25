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

Deck.dealCard = (fromDeck, toDeck, card) => {
  const cardIndex = fromDeck.cards.indexOf(card);
  if (cardIndex < 0) return;
  fromDeck.cards.splice(cardIndex, 1);
  card.unmount();
  Deck.addCard(toDeck, card);
};

Deck.dealCards = (fromDeck, toDeck, startCard) => {
  if (!startCard) startCard = fromDeck.cards[0];
  const startIndex = fromDeck.cards.indexOf(startCard);
  if (startIndex < 0) return;
  const cards = fromDeck.cards.splice(startIndex);
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    card.unmount();
    card.$el.style.zIndex = startCard.$el.style.zIndex + i;
    Deck.addCard(toDeck, card);
  }
};

Deck.addCard = (deck, card) => {
  deck.cards.push(card);
  card.mount(deck.$el);
  card.deck = deck;
  card.animateTo({
    delay: 0,
    duration: 0,
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
  const deckPos = deck.$el.getBoundingClientRect();
  for (let i = idx; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    card.$el.style.transform = `translate(${Math.round(card.x + dPos.x)}px, ${Math.round(card.y + dPos.y)}px)`;
  }
};

Deck.makeSpreadable = (deck) => {
  deck.isSpreadable = true;
  deck.spread = deck.queued(spread)

  function spread (next) {
    const len = deck.cards.length;
    deck.cards.forEach(function (card, i) {
      const z = i / 4
      const delay = i * 10

      card.animateTo({
        delay: 300 + delay,
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

  return deck;
};

Deck.forEachDeckXCard = (decks, fn) => decks.forEach((d) => d.cards.forEach((c, i) => fn(d, c, i)));

const Card = {};

Card.fontSize = () => window.getComputedStyle(document.body).getPropertyValue('font-size').slice(0, -2);

Card.enableDragging = (card) => {
  card.enableDragging();
  card.isDraggable = true;
};

Card.disableDragging = (card) => {
  card.disableDragging();
  card.isDraggable = false;
};

getEvtPosition = (evt) => {
  if (evt.type.includes('touch')) evt = evt.touches[0];
  return { x: evt.clientX, y: evt.clientY };
};

subtractPositions = (a, b) => {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
};

// Context creation stuff ////////////////////////////////////////////////
const initGlobalHandlers = () => {
  const resetElt = document.getElementById('resetButton');
  document.addEventListener('mousemove', (evt) => {
    const fn = evt.clientX > (0.5 * window.innerWidth) ? 'add' : 'remove';
    resetElt.classList[fn]("reflected");
  });
  resetElt.addEventListener('click', newGame);
};

const initGlobalState = () => {
  const boardElt = document.getElementById('board');
  const cellElts = document.getElementsByClassName('cell');
  const foundationElts = document.getElementsByClassName('foundation');
  const cascadeElts = document.getElementsByClassName('cascade');
  const dragDeck = document.getElementById('dragDeck');
  const winMessage = document.getElementById('winMessage');

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
      winMessage
    }
  };
  _state.board.cascades.forEach(Deck.makeSpreadable);
  return _state;
};

// Game creation stuff ////////////////////////////////////////////////

// TODO: BLEEEEEEEECcccH
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
    if (dragDeck.cards.length < 1) return;

    let originDeck = _state.drag.originDeck;
    _state.drag.originDeck = null;

    const evtPos = getEvtPosition(evt);
    let toDeck;
    let minDeckDistance = Infinity;
    [ ..._state.board.cascades,
      ..._state.board.foundations,
      ..._state.board.cells
    ].forEach((deck) => {
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
      Deck.dealCards(_state.drag.deck, toDeck);
    } else {
      Deck.dealCards(_state.drag.deck, originDeck);
    }
    updateState();
  };

  const grabCardsFn = (card) => (evt) => {
    // TODO: jesus
    if (!card.isDraggable) return;
    _state.drag.originDeck = card.deck;
    const pos = card.$el.getBoundingClientRect();
    Deck.move(_state.drag.deck, pos);
    Deck.dealCards(card.deck, _state.drag.deck, card);
    _state.drag.startPos = getEvtPosition(evt);
    return true;
  };

  const moveToFreeCellFn = (card) => {
    // Manual double click logic..... :\
    let clicks = 0;
    let lastClick = Date.now();
    return (evt) => {
      const dt = Date.now() - lastClick;
      lastClick = Date.now();
      if (++clicks < 2) return true;
      if (dt > 500) {
        clicks = 1;
        return true;
      }
      clicks = 0;

      if (card !== Deck.lastCard(card.deck)) return true;

      let freeCell;
      for (let i = 0; i < _state.board.cells.length; i++) {
        const cell = _state.board.cells[i];
        if (cell.cards.length < 1) {
          freeCell = cell;
          break;
        }
      }
      if (!freeCell) return true;

      Deck.deal(card.deck, freeCell);
      updateState();
      return true;
    };
  };

  document.addEventListener('mousemove', dragCards);
  document.addEventListener('touchmove', dragCards);
  document.addEventListener('mouseup', releaseCards);
  document.addEventListener('touchend', releaseCards);
  return (deck) => {
    // GRAB
    deck.cards.forEach((card) => {
      card.$el.addEventListener('mousedown', grabCardsFn(card));
      card.$el.addEventListener('touchstart', grabCardsFn(card));
      card.$el.addEventListener('mousedown', moveToFreeCellFn(card));
      card.$el.addEventListener('touchstart', moveToFreeCellFn(card));
    });
  }
})();

const newGame = () => {
  // First queue a test fn to make sure no decks are still animating
  for (let item in _state.board) {
    let busyDecks = _state.board[item].length;
    _state.board[item].forEach(d => d.queue((cb) => { busyDecks--; cb(); }));
    if (busyDecks > 0) return false;
  }

  for (let item in _state.board) {
    if (_state.board[item] && _state.board[item].length > 0) {
      _state.board[item].forEach(Deck.empty);
    }
  }

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
  Deck.forEachDeckXCard(_state.board.foundations, (deck, card) => Card.disableDragging(card));
  Deck.forEachDeckXCard(_state.board.cells, (deck, card) => {
    card.tableau = false;
    Card.enableDragging(card);
  });
  Deck.forEachDeckXCard(_state.board.cascades, (deck, card, idx) => {
    if (idx === 0) {
      card.tableau = !!card.tableau;
    } else {
      card.tableau = (card.tableau || deck.cards[idx - 1].tableau);
    }

    const availableCellCount = _state.board.cells.reduce((num, cell) => (num - cell.cards.length), 4)
    const deckOffset = Deck.lastIdx(deck) - deck.cards.indexOf(card);

    if ((card.tableau && deckOffset <= availableCellCount) || idx === Deck.lastIdx(deck)) {
      Card.enableDragging(card);
    } else {
      Card.disableDragging(card);
    }
  });
};

const updateWinState = () => {
  const remainingCards = _state.board.foundations.reduce((sum, deck) => (sum + deck.cards.length), 0);
  if (remainingCards < 1) {
    _state.ui.winMessage.style.width = 'inherit';
  } else {
    _state.ui.winMessage.style.width = '0';
  }
}

const canDeckReceiveCards = (deck, cards) => {
  const botCard = cards[0];
  // TODO: some marking?
  if (_state.board.cells.includes(deck)) {
    if (cards.length > 1) return false;
    return deck.cards.length < 1;
  }

  if (_state.board.foundations.includes(deck)) {
    if (cards.length > 1) return false;
    const prevCard = Deck.lastCard(deck);
    if (!prevCard) return botCard.rank === 1;
    return (prevCard.suit === botCard.suit &&
            prevCard.rank === botCard.rank - 1);

  }

  if (_state.board.cascades.includes(deck)) {
    const prevCard = Deck.lastCard(deck);
    if (!prevCard) return botCard.rank === 13;
    return (((prevCard.suit + botCard.suit) % 2) === 1 &&
            prevCard.rank === botCard.rank + 1);
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
//  [ ] resizing?
//  [ ] clean up lol











