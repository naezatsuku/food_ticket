import { describe, expect, it } from "vitest";
import { csvToBlob } from "../encoding";

describe("csvToBlob", () => {
  it("utf8-bom は先頭にBOMを付けたUTF-8になる", async () => {
    const blob = csvToBlob("氏名,時刻\n山田,09:00", "utf8-bom");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8").decode(bytes.slice(3));
    expect(text).toBe("氏名,時刻\n山田,09:00");
  });

  it("shift-jis は日本語を含むテキストを変換できる", async () => {
    const blob = csvToBlob("氏名,時刻\n山田,09:00", "shift-jis");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Shift_JISでは全角文字が2バイトになるため、UTF-8より短くなる(この例では)
    expect(bytes.length).toBeGreaterThan(0);
    const text = new TextDecoder("shift-jis").decode(bytes);
    expect(text).toBe("氏名,時刻\n山田,09:00");
  });
});
