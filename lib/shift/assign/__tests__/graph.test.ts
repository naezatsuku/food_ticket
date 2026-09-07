import { describe, expect, it } from "vitest";
import { MinCostFlow } from "../graph";

describe("MinCostFlow", () => {
  it("単純な二部マッチングで最大流・最小費用を求める", () => {
    // source(0) -> a(1),b(2) -> x(3),y(4) -> sink(5)
    const g = new MinCostFlow(6);
    g.addEdge(0, 1, 1, 0);
    g.addEdge(0, 2, 1, 0);
    const eAX = g.addEdge(1, 3, 1, 5);
    const eAY = g.addEdge(1, 4, 1, 1);
    const eBX = g.addEdge(2, 3, 1, 2);
    const eBY = g.addEdge(2, 4, 1, 9);
    g.addEdge(3, 5, 1, 0);
    g.addEdge(4, 5, 1, 0);

    const { totalCost, totalFlow } = g.run(0, 5);
    expect(totalFlow).toBe(2);
    // 最安の組み合わせは a→y(1) + b→x(2) = 3
    expect(totalCost).toBe(3);
    expect(g.flowOnEdge(eAY)).toBe(1);
    expect(g.flowOnEdge(eBX)).toBe(1);
    expect(g.flowOnEdge(eAX)).toBe(0);
    expect(g.flowOnEdge(eBY)).toBe(0);
  });

  it("並列辺の増加コストにより凸コスト割当(公平配分)を再現する", () => {
    // person(1) から3つの枠(2,3,4)へ。source->personは容量1コストk^2の並列辺を3本張り、
    // 各枠は容量1・コスト0でsinkへ。person一人にどこまで割り当たるかは並列辺の本数で制御される。
    const g = new MinCostFlow(6);
    g.addEdge(0, 1, 1, 0); // 1本目: コスト0
    g.addEdge(0, 1, 1, 1); // 2本目: コスト1
    g.addEdge(0, 1, 1, 4); // 3本目: コスト4
    g.addEdge(1, 2, 1, 0);
    g.addEdge(1, 3, 1, 0);
    g.addEdge(1, 4, 1, 0);
    g.addEdge(2, 5, 1, 0);
    g.addEdge(3, 5, 1, 0);
    g.addEdge(4, 5, 1, 0);

    const { totalCost, totalFlow } = g.run(0, 5);
    expect(totalFlow).toBe(3);
    expect(totalCost).toBe(0 + 1 + 4);
  });

  it("負のコストの辺(最低人数の優先充足)を正しく扱う", () => {
    const g = new MinCostFlow(4);
    g.addEdge(0, 1, 2, 0);
    const cheap = g.addEdge(1, 2, 1, -100);
    const normal = g.addEdge(1, 2, 1, 0);
    g.addEdge(2, 3, 2, 0);

    const { totalCost, totalFlow } = g.run(0, 3);
    expect(totalFlow).toBe(2);
    expect(totalCost).toBe(-100);
    expect(g.flowOnEdge(cheap)).toBe(1);
    expect(g.flowOnEdge(normal)).toBe(1);
  });

  it("経路が無ければ流量0", () => {
    const g = new MinCostFlow(3);
    g.addEdge(0, 1, 1, 0);
    // 2へは辺なし
    const { totalFlow } = g.run(0, 2);
    expect(totalFlow).toBe(0);
  });
});
