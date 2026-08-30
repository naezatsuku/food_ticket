// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseDelimitedText, parseHtmlTable } from "../parseSource";

describe("parseDelimitedText", () => {
  it("タブ区切りを解析する", () => {
    const text = "氏名\t時間帯\n山田太郎\t10:00-10:20\n鈴木花子\t11:00-11:20";
    expect(parseDelimitedText(text)).toEqual([
      ["氏名", "時間帯"],
      ["山田太郎", "10:00-10:20"],
      ["鈴木花子", "11:00-11:20"],
    ]);
  });
  it("カンマ区切りにも対応する(delimiter指定)", () => {
    const text = "a,b\nc,d";
    expect(parseDelimitedText(text, ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
  it("ダブルクォート囲みと内部のタブ・改行を扱う", () => {
    const text = '氏名\tメモ\n山田太郎\t"改行\nあり\tタブ"';
    const grid = parseDelimitedText(text);
    expect(grid[1][1]).toBe("改行\nあり\tタブ");
  });
  it("エスケープされた二重引用符を扱う", () => {
    const text = 'a\t"b""c"';
    expect(parseDelimitedText(text)[0]).toEqual(["a", 'b"c']);
  });
  it("末尾の空行は無視する", () => {
    const text = "a\tb\n\n";
    expect(parseDelimitedText(text)).toEqual([["a", "b"]]);
  });
});

describe("parseHtmlTable", () => {
  it("単純なテーブルを解析する", () => {
    const html = `
      <table>
        <tr><th>氏名</th><th>時間帯</th></tr>
        <tr><td>山田太郎</td><td>10:00-10:20</td></tr>
      </table>
    `;
    expect(parseHtmlTable(html)).toEqual([
      ["氏名", "時間帯"],
      ["山田太郎", "10:00-10:20"],
    ]);
  });
  it("colspan / rowspan を複製して矩形を保つ", () => {
    const html = `
      <table>
        <tr><td colspan="2">見出し</td></tr>
        <tr><td rowspan="2">左</td><td>右上</td></tr>
        <tr><td>右下</td></tr>
      </table>
    `;
    const grid = parseHtmlTable(html);
    expect(grid).toEqual([
      ["見出し", "見出し"],
      ["左", "右上"],
      ["左", "右下"],
    ]);
  });
  it("テーブルが無ければ空配列", () => {
    expect(parseHtmlTable("<div>no table</div>")).toEqual([]);
  });
});
