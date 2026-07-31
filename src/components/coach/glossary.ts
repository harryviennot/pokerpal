/**
 * Every word the coach uses, explained.
 *
 * The player's problem in their own words: "you're telling me what I'm doing and
 * if it's a mistake, but I don't actually know what blunder means." So each entry
 * carries both names — the term you would hear at a table and the phrase this app
 * uses in plain mode — because the mapping between the two registers is the thing
 * being taught, and this is the one screen where they sit side by side.
 *
 * Copy only. Definitions may describe how the coach computes something but must
 * never restate a figure from a specific hand; those come from the engine.
 */

import { type Grade, type Leak } from '@/engine';

export type GlossaryTermId =
  // The verdicts
  | 'correct'
  | 'marginal'
  | 'mistake'
  | 'blunder'
  | 'evLoss'
  // The habits
  | 'preflopLooseness'
  | 'chasingWithoutOdds'
  | 'missedValue'
  | 'overBluffing'
  | 'positional'
  // The math
  | 'equity'
  | 'potOdds'
  | 'requiredEquity'
  | 'outs'
  | 'draw'
  | 'range'
  | 'spr'
  // The table
  | 'pot'
  | 'blinds'
  | 'bigBlind'
  | 'button'
  | 'position'
  | 'street'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  // The moves
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allIn'
  | 'valueBet'
  | 'bluff';

export interface GlossaryEntry {
  id: GlossaryTermId;
  /** The word you would hear at a table. */
  term: string;
  /** What this app calls it in plain mode. Null when the two are the same word. */
  plain: string | null;
  /** One line, for a tooltip or a collapsed row. */
  short: string;
  /** The full explanation. Two or three sentences at most. */
  long: string;
  /** A concrete case, when an abstract definition is not enough on its own. */
  example?: string;
}

export const GLOSSARY: Record<GlossaryTermId, GlossaryEntry> = {
  correct: {
    id: 'correct',
    term: 'Correct',
    plain: 'Well played',
    short: 'The best move available, or near enough that nothing was lost.',
    long: 'The coach compares what you did against every other move you could have made and works out what each was worth. This is the top band: your move was the best one, or so close to it that the difference is not worth naming.',
  },
  marginal: {
    id: 'marginal',
    term: 'Marginal',
    plain: 'Close call',
    short: 'Not the best move, but it cost you under one big blind.',
    long: 'A spot where reasonable players disagree. Another move was worth slightly more, but the gap is small enough that this is a matter of style rather than a leak to fix.',
  },
  mistake: {
    id: 'mistake',
    term: 'Mistake',
    plain: 'Mistake',
    short: 'A clearly better move existed. It cost you one to four big blinds.',
    long: 'The gap between what you did and the best move is big enough to matter. Repeated over a session these are what turn a winning game into a losing one — which is why they are the ones the leak tracker counts.',
  },
  blunder: {
    id: 'blunder',
    term: 'Blunder',
    plain: 'Costly mistake',
    short: 'The worst band. More than four big blinds thrown away in one decision.',
    long: 'The single move most worth learning from. Something about the spot — the price, the strength of your hand, who was still to act — was read wrong by a wide margin. One of these can undo a whole session of solid play.',
    example: 'Calling a pot-sized bet with a hand that almost never wins is the usual shape.',
  },
  evLoss: {
    id: 'evLoss',
    term: 'EV loss',
    plain: 'What it cost you',
    short: 'The chips a decision gave up compared with the best move available.',
    long: 'Not the chips you actually lost in the hand — cards can save a bad decision and sink a good one. This is the average cost of making that choice in that spot, which is the only number that tells you anything about how you played.',
  },

  preflopLooseness: {
    id: 'preflopLooseness',
    term: 'Preflop looseness',
    plain: 'Playing too many hands',
    short: 'Entering pots with starting hands that do not rate to win.',
    long: 'The most common and most expensive beginner habit. Weak starting hands stay weak, and every chip you put in with one has to be won back by the hands that were actually worth playing.',
  },
  chasingWithoutOdds: {
    id: 'chasingWithoutOdds',
    term: 'Chasing without odds',
    plain: 'Paying too much to chase',
    short: 'Calling to hit a card when the price is worse than your chances.',
    long: 'Chasing a draw is fine when the pot pays you enough for it. This is the habit of calling anyway when it does not — the card you need arrives too rarely to be worth what you are paying to see it.',
  },
  missedValue: {
    id: 'missedValue',
    term: 'Missed value',
    plain: 'Not betting your good hands',
    short: 'Checking a hand that was likely best instead of betting it.',
    long: 'A strong hand only makes money if someone pays it off. Checking when you are ahead is not safe — it just quietly gives up the chips a worse hand would have called with.',
  },
  overBluffing: {
    id: 'overBluffing',
    term: 'Over-bluffing',
    plain: 'Bluffing too often',
    short: 'Putting chips in with a hand that is unlikely to be best.',
    long: 'Bluffing works because it is rare. Do it too often and the table stops folding, at which point you are simply betting your worst hands into their best ones.',
  },
  positional: {
    id: 'positional',
    term: 'Positional error',
    plain: 'Acting too early in the order',
    short: 'Committing chips with players behind you who have not acted yet.',
    long: 'Everyone who acts after you knows what you did before they decide; you know nothing about them. The more players still to speak, the stronger your hand needs to be.',
  },

  equity: {
    id: 'equity',
    term: 'Equity',
    plain: 'Your chances of winning',
    short: 'How often this hand wins if every remaining card is dealt out.',
    long: 'Written as a percentage. It is a share of the pot rather than a prediction: 30% equity means that if this exact spot happened a hundred times you would win about thirty of them.',
    example: 'A flush draw on the flop is roughly 35% against one opponent.',
  },
  potOdds: {
    id: 'potOdds',
    term: 'Pot odds',
    plain: 'The price you are being offered',
    short: 'What you must pay, measured against what you stand to win.',
    long: 'Comparing the two is the single most useful habit in poker. Pay 20 to win a pot of 100 and you only need to be right one time in six for the call to make money.',
  },
  requiredEquity: {
    id: 'requiredEquity',
    term: 'Required equity',
    plain: 'How often you need to win',
    short: 'The share of the time you must win for a call to break even.',
    long: 'Worked out from the price alone, with no reference to your cards. If your actual chances beat this number the call makes money over time, and if they do not it loses.',
  },
  outs: {
    id: 'outs',
    term: 'Outs',
    plain: 'Cards that save you',
    short: 'The cards still in the deck that would give you the best hand.',
    long: 'Counting them is how you estimate a draw at the table without doing real arithmetic. Nine cards complete a flush; eight complete a straight open at both ends.',
  },
  draw: {
    id: 'draw',
    term: 'Draw',
    plain: 'A hand that needs one more card',
    short: 'A hand that is not yet good but has cards that would make it good.',
    long: 'Worth chips only when the pot pays enough for the chance of hitting it. A draw with no price behind it is just a losing hand you are paying to keep.',
  },
  range: {
    id: 'range',
    term: 'Range',
    plain: 'What they could be holding',
    short: 'Every hand an opponent could have, given how they have played.',
    long: 'Strong players think about the whole set rather than guessing one hand. Someone who raised, bet the flop and bet again is not holding a random two cards, and the coach measures your chances against what their betting implies.',
  },
  spr: {
    id: 'spr',
    term: 'Stack-to-pot ratio',
    plain: 'How deep you are for this pot',
    short: 'Your remaining chips divided by the size of the pot.',
    long: 'It tells you how much room is left to manoeuvre. When it is low, the pot is close to committing you whatever comes; when it is high, there is plenty of betting still to come and marginal hands get harder to play.',
  },

  pot: {
    id: 'pot',
    term: 'Pot',
    plain: 'The chips in the middle',
    short: 'Everything wagered so far, which the winner of the hand collects.',
    long: 'Every bet size and every price in the app is quoted against it, because the pot is what makes a bet big or small. Betting 50 is enormous into a pot of 20 and tiny into a pot of 500.',
  },
  blinds: {
    id: 'blinds',
    term: 'Blinds',
    plain: 'The forced bets',
    short: 'Two chips-in-advance that start every hand, so there is something to play for.',
    long: 'They rotate around the table so everyone pays them equally often. Without them, folding every hand would cost nothing and nobody would ever play one.',
  },
  bigBlind: {
    id: 'bigBlind',
    term: 'Big blind',
    plain: 'One big blind',
    short: 'The larger forced bet, and the unit everything else is measured in.',
    long: 'The coach quotes costs in big blinds rather than chips so a verdict means the same thing at every stake. Losing two big blinds is the same size of error at 5/10 as at 50/100.',
  },
  button: {
    id: 'button',
    term: 'Button',
    plain: 'The dealer marker',
    short: 'The seat that acts last after the flop. The best seat at the table.',
    long: 'It moves one place to the left every hand. Acting last means you see what everyone else does before you decide, which is worth real money over a session.',
  },
  position: {
    id: 'position',
    term: 'Position',
    plain: 'Your place in the order',
    short: 'When you act relative to everyone else in the hand.',
    long: 'Acting late is an advantage and acting early is a handicap, so the same two cards are worth playing in one seat and worth folding in another.',
  },
  street: {
    id: 'street',
    term: 'Street',
    plain: 'Round of betting',
    short: 'One round of betting, named after the cards that opened it.',
    long: 'A hand has four: before the flop, then after each of the three deals that follow. The coach grades every decision separately and says which round it came from.',
  },
  preflop: {
    id: 'preflop',
    term: 'Preflop',
    plain: 'Before the flop',
    short: 'The first round, when you have only your own two cards.',
    long: 'Mistakes here are the most expensive kind, because the chips you commit before the flop are chips you keep defending for three more rounds.',
  },
  flop: {
    id: 'flop',
    term: 'Flop',
    plain: 'First three cards',
    short: 'The first three shared cards, dealt face up all at once.',
    long: 'The moment most hands are decided. Your two cards plus these three are usually enough to know whether you are playing for the pot or getting out of the way.',
  },
  turn: {
    id: 'turn',
    term: 'Turn',
    plain: 'Fourth card',
    short: 'The fourth shared card.',
    long: 'Bets tend to get large here, and there is only one card left for a draw to arrive on — so the price of chasing gets worse just as the cost of being wrong gets higher.',
  },
  river: {
    id: 'river',
    term: 'River',
    plain: 'Last card',
    short: 'The fifth and final shared card.',
    long: 'Nothing improves after this, so every hand is exactly what it is. There are no draws left to chase and no more cards to save you.',
  },
  showdown: {
    id: 'showdown',
    term: 'Showdown',
    plain: 'Cards on the table',
    short: 'Where the remaining players show their hands and the best one wins.',
    long: 'Only reached when the last bet is called. Most pots are won before this, by everyone else folding.',
  },

  fold: {
    id: 'fold',
    term: 'Fold',
    plain: 'Give up the hand',
    short: 'Throw the hand away and give up any claim to the pot.',
    long: 'Costs you nothing more than what you have already put in. Chips already in the middle are gone whatever you do next, so they should never talk you into paying more.',
  },
  check: {
    id: 'check',
    term: 'Check',
    plain: 'Stay in for free',
    short: 'Stay in the hand without putting any chips in.',
    long: 'Only available when nobody has bet. It keeps you in the hand at no cost, but it also gives up the chance of being paid when you are the one who is ahead.',
  },
  call: {
    id: 'call',
    term: 'Call',
    plain: 'Match their bet',
    short: 'Pay exactly what was bet, to stay in the hand.',
    long: 'The move worth checking a price against every time: what you are paying, against how often your hand actually wins.',
  },
  bet: {
    id: 'bet',
    term: 'Bet',
    plain: 'Put chips in first',
    short: 'Put chips in when nobody has yet this round.',
    long: 'Two reasons to do it: you are ahead and want to be paid, or you are behind and want them to give up. Betting for no reason at all is where most chips go.',
  },
  raise: {
    id: 'raise',
    term: 'Raise',
    plain: 'Put in more than they did',
    short: 'Increase a bet that someone else has already made.',
    long: 'The strongest thing you can do, because it can win the pot without your hand ever being best. It also costs the most when it is wrong.',
  },
  allIn: {
    id: 'allIn',
    term: 'All-in',
    plain: 'Every chip you have',
    short: 'Betting your whole stack.',
    long: 'You cannot lose more than you have, so you stay in until the end no matter how much others bet after you. Any bets beyond your stack are settled in a separate side pot.',
  },
  valueBet: {
    id: 'valueBet',
    term: 'Value bet',
    plain: 'Betting when you are ahead',
    short: 'Betting a hand you expect to be best, hoping to get called.',
    long: 'The opposite of a bluff, and where most of the money in poker is made. You want to be called, so the size should be one a worse hand can talk itself into paying.',
  },
  bluff: {
    id: 'bluff',
    term: 'Bluff',
    plain: 'Betting a hand that is losing',
    short: 'Betting a hand that is probably behind, to make better hands fold.',
    long: 'It works because you do not do it often. A bluff needs a believable story — a bet that makes sense given everything you have already done this hand.',
  },
};

export interface GlossarySection {
  title: string;
  terms: readonly GlossaryTermId[];
}

/**
 * Grouped the way a player meets the words, not alphabetically.
 *
 * The verdicts come first because they are what sent the reader here — the label
 * on the review they could not parse is the thing they tapped.
 */
export const GLOSSARY_SECTIONS: readonly GlossarySection[] = [
  {
    title: 'What the coach calls your decisions',
    terms: ['correct', 'marginal', 'mistake', 'blunder', 'evLoss'],
  },
  {
    title: 'Habits it looks for',
    terms: ['preflopLooseness', 'chasingWithoutOdds', 'missedValue', 'overBluffing', 'positional'],
  },
  {
    title: 'The math',
    terms: ['equity', 'potOdds', 'requiredEquity', 'outs', 'draw', 'range', 'spr'],
  },
  {
    title: 'Moves you can make',
    terms: ['fold', 'check', 'call', 'bet', 'raise', 'allIn', 'valueBet', 'bluff'],
  },
  {
    title: 'The table and the hand',
    terms: [
      'pot',
      'blinds',
      'bigBlind',
      'button',
      'position',
      'street',
      'preflop',
      'flop',
      'turn',
      'river',
      'showdown',
    ],
  },
];

/** The grade bands share their ids with the glossary, so a verdict is always tappable. */
export function termForGrade(grade: Grade): GlossaryTermId {
  return grade;
}

/** Likewise for the five habits the leak tracker reports. */
export function termForLeak(leak: Leak): GlossaryTermId {
  return leak;
}

/** The entry for a term id that arrived as an untrusted string, or null. */
export function lookupTerm(id: string | undefined): GlossaryEntry | null {
  return id !== undefined && id in GLOSSARY ? (GLOSSARY[id as GlossaryTermId] ?? null) : null;
}
