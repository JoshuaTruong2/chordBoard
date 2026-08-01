// Operations on the parsed sheet model: transposing chord lines and laying
// them out into aligned, collision-free rows.

// Transpose a chord line's tokens with the given transposer function, keeping
// their original columns. Non-chord tokens (e.g. "(x2)") are left untouched.
export function transposeTokens(tokens, transpose) {
  return tokens.map((t) => (t.isChord ? { ...t, text: transpose(t.text) } : { ...t }));
}

// Lay tokens out into a row. Each token keeps its original column when possible;
// if a previous (possibly widened) token would overlap, it is nudged right by
// the minimum amount while keeping a single separating space.
//
// Returns { segments, text }:
//   segments = [{ type: "space"|"chord"|"text", text }]  for rendering
//   text     = the full row as a plain string             for export / measuring
export function layoutRow(tokens) {
  const sorted = [...tokens].sort((a, b) => a.col - b.col);
  const segments = [];
  let cursor = 0;
  for (const t of sorted) {
    let start = t.col;
    // Nudge right if this token would overlap OR butt directly against the
    // previous one (e.g. a chord widened by transposition, like B -> Bb),
    // so adjacent tokens always keep at least one separating space.
    if (start <= cursor && cursor > 0) {
      start = cursor + 1;
    }
    const gap = start - cursor;
    if (gap > 0) {
      segments.push({ type: "space", text: " ".repeat(gap) });
      cursor += gap;
    }
    segments.push({ type: t.isChord ? "chord" : "text", text: t.text, col: t.col });
    cursor += t.text.length;
  }
  const text = segments.map((s) => s.text).join("");
  return { segments, text };
}

// Produce a fully transposed copy of the model (used for export).
export function transposeSheet(model, transpose) {
  return {
    meta: model.meta,
    lines: model.lines.map((line) =>
      line.kind === "chord"
        ? { ...line, tokens: transposeTokens(line.tokens, transpose) }
        : line
    ),
  };
}
