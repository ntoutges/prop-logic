const propLogic = require("./propLogicNode.js");

const tests = [
  "pv(q^r)"
]

const variables = {
  p: false,
  q: false,
  r: true
}

for (const test of tests) {
  let output = test;
  output += "  ->  ";
  const tokens = propLogic.algToRPLN(
    propLogic.trimTokens(
      propLogic.getTokensFromString(test)
    )
  );
  
  // output += tokens.toString();
  const strs = [];
  for (const token of tokens) {
    strs.push(token.toShortString());
  }
  output += "[" + strs.join(" ") + "]";

  output += " f(" + propLogic.getVars(tokens) + ")";
  
  // output += " | output: " + (propLogic.executeRPLN(tokens, variables) ? "true" : "false");
  output += " [" + propLogic.executeAllPossibleRPLN(tokens).map((value) => { return value ? 1 : 0 }).join(",") + "]";
  console.log(output)
}