import * as propLogic from "./propLogic.js"

const $ = document.querySelector.bind(document);

const highlightColors = {
  "negation": "#ff0000",
  "conjunction": "#279127",
  "disjunction": "#2727b3",
  "conditional": "white",
  "biconditional": "#636363",
  "xor": "orange",
  "text": "#fc85ff",
  "white-space": "black",
  "parentheses-open": "yellow",
  "parentheses-close": "yellow"
}

$("#input-text").addEventListener("focus", () => {
  $("#input-underline").classList.add("focuses");
});

$("#input-text").addEventListener("blur", () => {
  $("#input-underline").classList.remove("focuses");
});

$("#input-text").addEventListener("keydown", (e) => {
  if (e.key == "Enter" || e.key == "Escape") {
    $("#input-text").blur();
  }
});

$("#input-text").addEventListener("input", () => {
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
  
  try {
    generateTruthTable(tokens);
    $("#errs").innerHTML = ""; // clear error if no error
  }
  catch (err) {
    $("#truth-table").innerHTML = "";
    $("#errs").innerText = err.err;
  }
});

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
    insertInputIntoGridItem(gridItemEl);
  }

  const eqEl = generateGridItem(truthTable);
  eqEl.querySelector(".truth-table-texts").append(generateEquationEl(tokens));
  insertInputIntoGridItem(eqEl);

  // generate values of truth table
  const RPLN = propLogic.algToRPLN(tokens);
  const vars = {};
  const values = [];
  for (const variable of variables) { vars[variable] = false; }

  for (let i = 2 ** variables.length-1; i >= 0; i--) {
    let j = variables.length-1;
    for (const key in vars) {
      const val = ((i >> j) % 2 == 1);
      vars[key] = val;
      values[variables.length-j-1] = val;
      j--;
    }

    values[variables.length] = propLogic.executeRPLN(RPLN, vars);
    generateTruthTableRow(values, truthTable);
  }

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

function insertInputIntoGridItem(gridItemEl) {
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
  });

  setFalse.addEventListener("click", () => {
    gridItemEl.classList.toggle("falses");
  });
  
  gridItemEl.append(input);
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
    
    text.append(tokenEl);  
    highlights.append(highlight);
  }
  return output;
}