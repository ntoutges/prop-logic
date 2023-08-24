const symbols = {
  "~": "negation",
  "!": "negation",

  "^": "conjunction",
  "&": "conjunction",

  "v": "disjunction",
  "|": "disjunction",

  "->": "conditional",
  // "<-": "conditional-reversed",
  
  "<->": "biconditional",
  "==": "biconditional", // equivalent

  "+": "xor",

  // officially better than desmos, as I allow "[" and "]"!
  "(": "parentheses-open",
  "[": "parentheses-open",
  ")": "parentheses-close",
  "]": "parentheses-close",
  
  " ": "white-space" // housekeeping symbol (not actually used, just to get rid of whitespace)
};

const symbolPriority = {
  "negation": 50,
  "conjunction": 40,
  "disjunction": 30,
  "conditional": 20,
  "biconditional": 10,

  // less than no priority, don't try to check these in that system
  "text": -100,
  "section": -100
}

// (algebraic) includes this symbol, and the symbol after it
// (RPLN)      includes this symbol, and the symbol before it
const unarySymbolsArr = [
  "negation"
];

// (algebraic) includes this symbol, and the symbols before and after it
// (RPLN)      includes this sybol, and the 2 symbols before it
const compoundSymbolsArr = [
  "disjunction",
  "conjunction",
  "conditional",
  "biconditional",
  "xor"
];

// build sets from simple arrays
const unarySymbols = {};
const compoundSymbols = {};
const symbolsArr = [];
const symbolsFirstChar = {};
{
  for (const symbol of unarySymbolsArr) { unarySymbols[symbol] = true; }
  for (const symbol of compoundSymbolsArr) { compoundSymbols[symbol] = true; }

  for (const i in symbols) { symbolsArr.push(i); }
  symbolsArr.sort((a,b) => { return b.length - a.length });

  for (const i in symbolsArr) { // hash first character, for quickly referencing array
    const symbol = symbolsArr[i];
    if (!(symbol[0] in symbolsFirstChar)) symbolsFirstChar[symbol[0]] = [];
    symbolsFirstChar[symbol[0]].push(+i);
  }
}

exports.getTokensFromString = (text) => {
  // essentially a greedy algorithm
  const tokens = [];
  let oldI = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] in symbolsFirstChar) {
      let wasSymbol = false;
      for (const symbolIndex of symbolsFirstChar[text[i]]) {
        const symbol = symbolsArr[symbolIndex];
        let substr = text.substring(i,i+symbol.length);
        if (substr == symbol) {
          if (i != oldI) { // last token is text
            tokens.push(
              new Token({
                start: oldI,
                text: text.substring(oldI,i),
                type: "text"
              })
            );
          }
          tokens.push(
            new Token({
              start: i,
              text: symbol,
              type: symbols[symbol]
            })
          );
          
          i += symbol.length;
          oldI = i;
          wasSymbol = true;
          break;
        }
      }
      if (!wasSymbol) { i++; } // increment i to next position
    }
    else { i++; }
  }
  if (oldI != i) {
    tokens.push(
      new Token({
        start: oldI,
        text: text.substring(oldI, i),
        type: "text"
      })
    )
  }

  return tokens;
}

// remove whitespace
exports.trimTokens = (tokens=[]) => {
  const trimmed = [];
  for (const token of tokens) {
    if (token.type != "white-space") {
      trimmed.push(token);
    }
  }
  return trimmed;
}

// returns a list of all variables: string[]
exports.getVars = (tokens=[]) => { // Token[]
  const vars = {};
  for (const token of tokens) {
    if (token.type == "text") {
      vars[token.text] = true;
    }
  }

  const varArr = [];
  for (const i in vars) {
    varArr.push(i);
  }
  return varArr;
}

// extract data from standard (algebraic) notation into easily interpreted RPLN
exports.algToRPLN = (tokens) => {
  const working_tokens = tokens.slice(); // make shallow copy

  // resolveMissingParentheses(working_tokens);

  while (true) {
    const [openIndex,closeIndex] = getDeepestParenthesesPair(working_tokens);
    let working_tokens_part = working_tokens; // there aren't parentheses (default assumption)
    
    if (openIndex != -1) { // there ARE parentheses
      const tokens_including_parentheses = working_tokens.splice(openIndex, closeIndex-openIndex+1);
      working_tokens_part = tokens_including_parentheses.splice(1, tokens_including_parentheses.length-2); // remove parentheses
    }

    // continue combining tokens until nothing left to combine
    while (combineTokensIntoSections(working_tokens_part)) {}
      
    if (working_tokens_part.length != 1) { // tokens were not all compressed into one section
      throw new PropError({
        err: "Tokens were not properly sectionalized",
        data:  working_tokens
      });
    }

    if (openIndex == -1) { break; } // this was the last itteration, break out of loop
    else working_tokens.splice(openIndex,0, working_tokens_part[0]); // insert section back into list
  }

  console.log(working_tokens[0].toString())

  if (working_tokens[0] instanceof Section) return working_tokens[0].toRPLN();
  return working_tokens; // RPN and ALG form of a single term is the same
}

// if missing parentheses, fix it
// currently doesn't accound for difference in [] and ()
exports.resolveMissingParentheses = (tokens) => { // Token[]
  let total = 0; // >0 -> too many openers, <0 -> too many closers
  for (const token of tokens) {
    if (token.type == "parentheses-open") total++;
    else if (token.type == "parentheses-close") total--;
  }

  if (total > 0) { // add [total] closing parentheses to the end
    for (let i = 0; i < total; i++) {
      tokens.push(
        new Token({
          start: tokens[tokens.length-1].end+1,
          text: ")",
          type: "parentheses-close"
        })
      );
    }
  }
  else if (total < 0) { // add [-total] closing parentheses to the front
    for (let i = 0; i < -total; i++) {
      tokens.splice(
        0,0,
        new Token({
          start: i,
          text: ")",
          type: "parentheses-close"
        })
      );
    }
    // shift everything to account for the extra parentheses
    for (let i = -total; i < tokens.length; i++) {
      tokens[i].renumber(-total);
    }
  }
}

// returns: [start, end] (start and end are centered on parentheses)
function getDeepestParenthesesPair(tokens) { // Token[]
  let openIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type == "parentheses-open") { openIndex = i; }
    else if (token.type == "parentheses-close") {
      return [openIndex, i];
    }
  }

  return [-1,-1]; // nothing found, return sentinel
}

function getPrecedence(token) { // Token
  if (!(token.type in symbolPriority)) return 0; // no precedence
  return symbolPriority[token.type];
}

function getMaxPrecedence(tokens) { // Token[]
  let maxPrecedence = -100; // no precedence default
  for (const token of tokens) { // loop through all tokens, and if there is a precedence for a token type, set it
    maxPrecedence = Math.max(maxPrecedence, getPrecedence(token));
  }
  return maxPrecedence;
}

function combineTokensIntoSections(tokens) { // Token[] // returns if maxTokens was valid (>= 0)
  const maxPrecedence = getMaxPrecedence(tokens);
  if (maxPrecedence < 0) return false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (getPrecedence(token) == maxPrecedence) {
      if (unarySymbols[token.type]) { // take this token, and the one after it
        if (i == tokens.length-1) { // unable to take next token
          throw new PropError({
            err: `Unary operator does not operate on any other symbols`,
            data: {
              token,
              tokens,
              i
            }
          });
        }
        const section = new UnarySection({
          tokens: tokens.splice(i,2) // remove tokens from list, and shove them into the section
        });
        tokens.splice(i,0,section); // put the section back into the list

        // [i] need not be changed, because the length of the list has shrunken on its own
      }
      else if (compoundSymbols[token.type]) {
        if (i == 0 || i == tokens.length-1) { // unable to take next or previous token
          throw new PropError({
            err: `Compound operator does not operate on any other symbols`,
            data: {
              token,
              tokens,
              i
            }
          });
        }

        i--; // decrease i to start at first token operated on by composite operator
        const section = new CompoundSection({
          tokens: tokens.splice(i, 3)
        });
        tokens.splice(i,0, section);
      }
      else {
        throw new PropError({
          err: `Neither compound nor unary for symbol type: ${token.type}`,
          data: token
        });
      }
    }
  }

  return true;
}

// Reverse Polish Logic Notation
// this is the logical engine behind the whole program
exports.executeRPLN = (tokens=[], variables={}) => { // Token[], Record<string,boolean>
  const stack = new Stack(); // will ONLY contain bools

  for (const token of tokens) {
    switch (token.type) {
      case "text": { // push value into stack
        stack.push(
          (token.text in variables)
          && variables[token.text]
        );
        break;
      }
      case "negation":
        stack.push(
          !stack.pull() // negate operation
        );
        break;
      case "disjunction":
        stack.push(
          stack.pull() | stack.pull() // disjunction = or operation
        );
        break;
      case "conjunction":
        stack.push(
          stack.pull() & stack.pull() // conjunction = and operation
        );
        break;
      case "conditional": // reversed version should be squished into standard
        stack.push(
          !stack.pull() & stack.pull() // order: Y,X // X -> Y // X && !Y
        );
        break;
      case "biconditional": // order: Y,X // X == Y
        stack.push(
          stack.pull() == stack.pull()
        );
        break;
      case "xor":
        stack.push(
          stack.pull() != stack.pull()
        );
        break;
      case "white-space": // ignore
        break;
      // parentheses are not valid in RPLN
      default:
        throw new Error("Unhandled type: " + token.type);
    }
  }

  stack.assertHeight(1);
  return stack.pull(); // last item on stack is the answer
}

// more for testing than actual production
exports.executeAllPossibleRPLN = (tokens=[]) => {
  const vars = exports.getVars(tokens);
  const varVals = {};
  for (const key of vars) { varVals[key] = false; }

  let outputs = [];

  for (let i = 2 ** vars.length - 1; i >= 0; i--) {
    let j = vars.length-1;
    for (const key in varVals) {
      varVals[key] = ((i >> j) % 2 == 1);
      j--;
    }

    outputs.push(exports.executeRPLN(tokens, varVals));
  }

  return outputs;
}

class Token {
  constructor({
    start,
    type,
    text
  }) {
    this.m_start = start;
    this.m_end = start + text.length;
    this.m_type = type;
    this.m_text = text;
  }

  toString() {
    return `[${this.type}:\"${this.text}\"]`;
  }
  toShortString() { return this.text; }

  get type() { return this.m_type; }
  get text() { return this.m_text; }
  get start() { return this.m_start; }
  get end() { return this.m_end; }
  renumber(shift) { // shift: number
    this.m_start += shift;
    this.m_end += shift;
  }
}

class Section extends Token {
  constructor({
    tokens, // Token[]
    text
  }) {
    super({
      start: -1, // signifies that this number doesn't actually matter
      type: "section",
      text
    });

    this.m_tokens = tokens;
  }

  toString() {
    const children = [];
    for (const token of this.m_tokens) { children.push(token.toString()); }
    return `[section:\"${children.join(",")}\"]`;
  }

  toRPLN() { return []; } // abstract functino, don't use this directly
}

class UnarySection extends Section {
  constructor({
    tokens // Token[]
  }) {
    if (tokens.length != 2) {
      throw new PropError({
        err: "Invalid amount of tokens for UnarySection",
        data: tokens
      });
    }

    super({
      tokens,
      text: "UnarySection"
    });
  }

  toRPLN() {
    // convert sub-sections into standard tokens
    let arg1 = [this.m_tokens[1]];
    if (arg1[0] instanceof Section) arg1 = arg1[0].toRPLN();
    
    // reverse direction of tokens ([~b] -> [b ~])
    return [].concat(
      arg1,
      [this.m_tokens[0]]
    );
  }
}

class CompoundSection extends Section {
  constructor({
    tokens // Token[]
  }) {
    if (tokens.length != 3) {
      throw new PropError({
        err: "Invalid amount of tokens for CompoundSection",
        data: tokens
      });
    }

    super({
      tokens,
      text: "CompoundSection"
    });
  }

  toRPLN() {
    // convert sub-sections into standard tokens
    let arg1 = [this.m_tokens[0]];
    let arg2 = [this.m_tokens[2]];
    if (arg1[0] instanceof Section) arg1 = arg1[0].toRPLN();
    if (arg2[0] instanceof Section) arg2 = arg2[0].toRPLN();

    // bring arguments to front (in order), and operator to the end ([a+b] -> [a b +])
    return [].concat(
      arg1,
      arg2,
      [this.m_tokens[1]]
    );
  }
}

class Stack {
  constructor() {
    this.arr = [];
  }

  push(val) { this.arr.push(val); }
  pull() {
    if (this.isEmpty()) throw new Error("Empty stack");
    return this.arr.pop();
  }
  get() { // pull, without removing from list
    if (this.isEmpty()) throw new Error("Empty stack");
    return this.arr[this.arr.length-1];
  }
  clear() {
    this.arr.splice(0,this.arr.length);
  }
  isEmpty() { return this.arr.length == 0; }
  assertHeight(height=0) {
    if (height != this.arr.length) {
      throw new PropError({
        err: `Stack not of height ${height}`,
        data: {
          stack: this.arr,
          assertedHeight: height
        }
      })
    }
  }
}

class PropError {
  constructor({
    err,
    data
  }) {
    this.err = err;
    this.data = data;
  }

  toString() { return this.err; }
}

