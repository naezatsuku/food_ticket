/** 2次元配列としての取り込みデータ(全行の列数は揃えてある) */
export type ParsedGrid = string[][];

function toRectangular(rows: string[][]): ParsedGrid {
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return rows.map((r) => Array.from({ length: maxCols }, (_, i) => (r[i] ?? "").trim()));
}

/**
 * クリップボードの text/html を解析し、最初の <table> をグリッドに変換する。
 * colspan / rowspan で結合されたセルは、その範囲すべてに同じ値を複製して矩形を保つ。
 */
export function parseHtmlTable(html: string): ParsedGrid {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const trs = Array.from(table.querySelectorAll("tr"));
  const grid: string[][] = [];

  trs.forEach((tr, rowIndex) => {
    grid[rowIndex] = grid[rowIndex] ?? [];
    let colIndex = 0;
    const nextFreeCol = () => {
      while (grid[rowIndex][colIndex] !== undefined) colIndex++;
      return colIndex;
    };
    Array.from(tr.children).forEach((cellEl) => {
      const el = cellEl as HTMLTableCellElement;
      if (el.tagName !== "TD" && el.tagName !== "TH") return;
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      const colspan = el.colSpan || 1;
      const rowspan = el.rowSpan || 1;
      const startCol = nextFreeCol();
      for (let dr = 0; dr < rowspan; dr++) {
        const targetRow = rowIndex + dr;
        grid[targetRow] = grid[targetRow] ?? [];
        for (let dc = 0; dc < colspan; dc++) {
          grid[targetRow][startCol + dc] = text;
        }
      }
      colIndex = startCol + colspan;
    });
  });

  return toRectangular(grid);
}

/**
 * タブ区切り(またはカンマ区切り)テキストを解析する。
 * ダブルクォート囲み("" によるエスケープ含む)に対応する。
 */
export function parseDelimitedText(text: string, delimiter = "\t"): ParsedGrid {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  return toRectangular(nonEmptyRows);
}
