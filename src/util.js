function toJoined(str) {
  return str.replace("-", "");
}

function toSnake(str) {
  return str.replace("-", "_");
}

function toCamel(str) {
  const tokens = str.split("-");
  return `${tokens[0]}${tokens
    .slice(1)
    .map((s) => `${s[0].toUpperCase()}${s.slice(1)}`)
    .join("")}`;
}

function toPascal(str) {
  const tokens = str.split("-");
  return tokens.map((s) => `${s[0].toUpperCase()}${s.slice(1)}`).join("");
}

function createConversions(fromName, toName) {
  return [
    {
      from: fromName,
      to: toName,
    },
    {
      from: toJoined(fromName),
      to: toJoined(toName),
    },
    {
      from: toSnake(fromName),
      to: toSnake(toName),
    },
    {
      from: toCamel(fromName),
      to: toCamel(toName),
    },
    {
      from: toPascal(fromName),
      to: toPascal(toName),
    },
  ];
}

function convert(conversions, str) {
  conversions.forEach((c) => (str = str.replaceAll(c.from, c.to)));
  return str;
}

module.exports = {
  createConversions,
  convert,
};
