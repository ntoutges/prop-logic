import * as propLogic from "./propLogic.js"

const $ = document.querySelector.bind(document);

const highlightColors = {
  "negation": "#ff0000",
  "conjunction": "#6fed6f",
  "disjunction": "#2727b3",
  "conditional": "white",
  "conditional-rev": "white",
  "biconditional": "#636363",
  "xor": "orange",
  "text": "#fc85ff",
  "white-space": "black",
  "parentheses-open": "yellow",
  "parentheses-close": "yellow",
  "true": "green",
  "false": "red"
}

let setIndicies = {};

$("#input-text").addEventListener("focus", focus);

function focus() { $("#input-underline").classList.add("focuses"); }

$("#input-text").addEventListener("blur", () => {
  $("#input-underline").classList.remove("focuses");
});

$("#input-text").addEventListener("keydown", (e) => {
  if (e.key == "Enter" || e.key == "Escape") {
    $("#input-text").blur();
  }
});

{
  const parent = $("#help");
  for (const category in propLogic.symbolsPossibilities) {
    const symbols = propLogic.symbolsPossibilities[category];
    const categoryEl = document.createElement("div");
    categoryEl.classList.add("category");

    const desc = document.createElement("span");
    desc.innerText = category + ":";
    categoryEl.append(desc);

    for (const symbol of symbols) {
      const el = document.createElement("span");
      const spacer = document.createElement("span");
      spacer.classList.add("no-select")
      el.innerText = symbol;
      spacer.innerText = " ";
      categoryEl.append(el);
      categoryEl.append(spacer);
    }
    parent.append(categoryEl);
  }
}

$("#input-text").addEventListener("input", generateTokens);

function generateTokens() {
  const input = $("#input-text").value;
  const tokens = propLogic.getTokensFromString(input);
  
  const indicies = [];
  const colors = [];
  for (const token of tokens) {
    indicies.push(token.end);
    colors.push(highlightColors[token.type]);
  }

  propLogic.trimTokens(tokens);
  propLogic.resolveMissingParentheses(tokens);
  
  setHighlights(indicies,colors);
  
  let outputs = [];
  let varCount = propLogic.getVars(tokens).length;

  try {
    outputs = generateTruthTable(tokens);
    $("#errs").innerHTML = ""; // clear error if no error
  }
  catch (err) {
    $("#truth-table").innerHTML = "";
    $("#errs").innerText = err.err;
    varCount = 0; // error means no variables can be accounted for
  }

  const combinations = 2 ** varCount;
  $("#combinations-count").innerText = varCount ? combinations : "";
  $("#variables-count").innerText = varCount ? varCount : "";

  if (outputs.length == 0) $("#proposition-type").innerText = "";
  else {
    let trues = 0;
    outputs.forEach(bool => { if (bool) trues++; });

    const propType = $("#proposition-type");
    if (trues == 0) { // all outputs FALSE
      propType.innerText = "Contradiction";
      propType.setAttribute("title", "output is always FALSE");
    }
    else if (trues == outputs.length) { // all outputs TRUE
      propType.innerText = "Tautology";
      propType.setAttribute("title", "output is always TRUE");
    }
    else { // outputs are mixed between TRUE and FALSE
      propType.innerText = "Contingency";
      propType.setAttribute("title", "output varies based on inputs");
    }

    const RPLN_content = $("#rpln-content");
    RPLN_content.innerHTML = ""; // clear

    const RPLN_tokens = propLogic.algToRPLN(tokens)
    for (const token of RPLN_tokens) {
      const el = document.createElement("div");
      el.classList.add("RPLN-tokens");
      el.innerText = token.text;
      // el.style.backgroundColor = highlightColors[token.type] ?? "transparent";
      el.setAttribute("title", token.type);
      RPLN_content.append(el);
    }

    for (const key in setIndicies) {
      if (+key >= gridWidth) { delete setIndicies[key]; } // unusable and will just be confusing
    }
  }
}

function setHighlights(indicies=[], colors=[]) {
  const text = $("#input-text").value;
  const parent = $("#input-highlights");
  parent.innerHTML = ""; // clear

  let lastIndex = 0;
  indicies.forEach((index,i) => {
    const thisText = text.substring(lastIndex,index);
    if (thisText.length == 0) return;

    const highlight = document.createElement("div");
    highlight.innerText = thisText;
    highlight.classList.add("highlights");
    highlight.style.backgroundColor = colors[Math.min(i, colors.length-1)] ?? "transparent";
    parent.append(highlight);

    lastIndex = index;
  })
}

let gridIndex = 0;
let gridWidth = 0;
function generateTruthTable(tokens) {
  const truthTable = $("#truth-table");
  truthTable.innerHTML = "";

  const variables = propLogic.getVars(tokens);

  gridIndex = 0;
  gridWidth = variables.length + 1; // width is all variables + final equation

  truthTable.style.gridTemplateColumns = `repeat(${gridWidth}, auto)`;

  // generate variable headers
  for (let i in variables) {
    const gridItemEl = generateGridItem(truthTable);
    gridItemEl.querySelector(".truth-table-texts").innerText = variables[i];
    insertInputIntoGridItem(gridItemEl, +i);
  }

  const eqEl = generateGridItem(truthTable);
  eqEl.querySelector(".truth-table-texts").append(generateEquationEl(tokens));
  insertInputIntoGridItem(eqEl, variables.length);

  // generate values of truth table
  const RPLN = propLogic.algToRPLN(tokens);
  const vars = {};
  const values = [];
  const outputs = [];
  for (const variable of variables) { vars[variable] = false; }

  for (let i = 2 ** variables.length-1; i >= 0; i--) {
    let j = variables.length-1;
    for (const key in vars) {
      const val = ((i >> j) % 2 == 1);
      vars[key] = val;
      values[variables.length-j-1] = val;
      j--;
    }

    const output = !!propLogic.executeRPLN(RPLN, vars);
    values[variables.length] = output;
    outputs.push(output);
    generateTruthTableRow(values, truthTable);
  }

  return outputs;
}

function generateTruthTableRow(values=[], parent) { // boolean
  for (let i = 0; i < gridWidth; i++) {
    if (i < values.length) {
      const el = generateGridItem(parent);
      el.innerText = (values[i] ? "T" : "F");
      el.classList.add(values[i] ? "trues" : "falses");
    }
    else {
      generateGridItem(parent).innerText = "/";
    }
  }
}

function generateGridItem(parent) {
  const item = document.createElement("div");
  const text = document.createElement("div");
  item.classList.add("truth-table-items");
  text.classList.add("truth-table-texts");
  
  if (gridIndex % gridWidth == 0) item.classList.add("row-starts");
  if (gridIndex < gridWidth) item.classList.add("headers");
  gridIndex++;

  item.append(text);
  parent.append(item);
  return item;
}

function insertInputIntoGridItem(gridItemEl, index) {
  gridItemEl.setAttribute("data-index", index);
  const input = document.createElement("div");
  input.classList.add("truth-table-inputs");

  const setTrue = document.createElement("button");
  setTrue.append("T");
  setTrue.classList.add("inputs-trues");

  const setFalse = document.createElement("button");
  setFalse.append("F");
  setFalse.classList.add("inputs-falses");

  input.append(setTrue);
  input.append(setFalse);

  setTrue.addEventListener("click", () => {
    gridItemEl.classList.toggle("trues");
    
    const index = gridItemEl.getAttribute("data-index");
    if (gridItemEl.classList.contains("trues")) setIndicies[index] = true;
    else delete setIndicies[index]
    modifyTruthTable();
  });

  setFalse.addEventListener("click", () => {
    gridItemEl.classList.toggle("falses");

    const index = gridItemEl.getAttribute("data-index");
    if (gridItemEl.classList.contains("falses")) setIndicies[index] = false;
    else delete setIndicies[index];
    modifyTruthTable();
  });

  // take advantage of event system in JS, event will only run AFTER block of code to generate truth table is finished
  // as such, this runs after that
  if (index in setIndicies) {
    setTimeout(() => { (setIndicies[index] ? setTrue : setFalse).click(); });
  }
  
  gridItemEl.append(input);
}

function modifyTruthTable() { // boolean[]
  const parent = $("#truth-table");
  
  // unhide everything (clean start) -- skip headers because they don't matter
  for (let i = gridWidth; i < parent.children.length; i++) {
    parent.children[i].classList.remove("hiddens"); // reset to default CSS
  }

  // algorithm to hide inputs
  for (let index in setIndicies) {
    const isTrue = setIndicies[index];
    const bitVal = gridWidth - index - 2;

    if (bitVal < 0) { continue; } // ignore output, this will come up later

    let i = 0;
    for (let gI = gridWidth; gI < parent.children.length; gI += gridWidth) { // skip by rows
      if ((i >> bitVal) % 2 == isTrue) { // hide these
        for (let j = 0; j < gridWidth; j++) { // hide all in row
          parent.children[gI+j].classList.add("hiddens"); // hide
        }
      }
      i++;
    }
  }

  if (!((gridWidth-1) in setIndicies)) return; // output row not set, ignore
  const isTrue = setIndicies[gridWidth-1];

  for (let i = 2*gridWidth-1; i < parent.children.length; i += gridWidth) {
    if (parent.children[i].classList.contains(isTrue ? "falses" : "trues")) { // weed out anything that DOESN'T match
      for (let j = -gridWidth+1; j <= 0; j++) {
        parent.children[i+j].classList.add("hiddens");
      }
    }
  }
}

function generateEquationEl(tokens) {
  const output = document.createElement("div");
  output.classList.add("eq-holders");

  const text = document.createElement("div");
  const highlights = document.createElement("div");
  highlights.classList.add("token-highlights-parent")

  output.append(text);
  output.append(highlights);

  for (const token of tokens) {
    const tokenEl = document.createElement("div");
    const highlight = document.createElement("div");
    tokenEl.classList.add("token-elements");
    
    highlight.classList.add("highlights", "token-highlights");
    
    tokenEl.innerText = token.text;
    highlight.style.backgroundColor = highlightColors[token.type] ?? "transparent";
    highlight.innerText = token.text;
    highlight.setAttribute("title", token.type);
    
    text.append(tokenEl);  
    highlights.append(highlight);
  }
  return output;
}

generateTokens(); // fill in default example
focus();