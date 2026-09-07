/**
 * 汎用の最小費用流ソルバー(SPFA による successive shortest augmenting path)。
 * 負のコストの辺を扱えるが、負閉路が無いことが前提(このアプリのグラフは
 * source→人→人×枠→枠×役割→sink の層状DAGなので負閉路は発生しない)。
 */
export class MinCostFlow {
  private readonly graph: number[][];
  private readonly to: number[] = [];
  private readonly cap: number[] = [];
  private readonly cost: number[] = [];
  private readonly flow: number[] = [];

  constructor(nodeCount: number) {
    this.graph = Array.from({ length: nodeCount }, () => []);
  }

  /** capacity・cost の辺を張る(逆辺は自動生成)。戻り値は辺のインデックス */
  addEdge(from: number, toNode: number, capacity: number, unitCost: number): number {
    const id = this.to.length;
    this.graph[from].push(id);
    this.to.push(toNode);
    this.cap.push(capacity);
    this.cost.push(unitCost);
    this.flow.push(0);

    this.graph[toNode].push(id + 1);
    this.to.push(from);
    this.cap.push(0);
    this.cost.push(-unitCost);
    this.flow.push(0);

    return id;
  }

  flowOnEdge(edgeId: number): number {
    return this.flow[edgeId];
  }

  /** source から sink へ最小費用で流せるだけ流す */
  run(source: number, sink: number): { totalCost: number; totalFlow: number } {
    const n = this.graph.length;
    let totalCost = 0;
    let totalFlow = 0;

    for (;;) {
      const dist = new Array<number>(n).fill(Infinity);
      const inQueue = new Array<boolean>(n).fill(false);
      const prevEdge = new Array<number>(n).fill(-1);
      dist[source] = 0;

      const queue: number[] = [source];
      inQueue[source] = true;
      let head = 0;
      while (head < queue.length) {
        const u = queue[head++];
        inQueue[u] = false;
        for (const eid of this.graph[u]) {
          if (this.cap[eid] - this.flow[eid] <= 0) continue;
          const v = this.to[eid];
          const nd = dist[u] + this.cost[eid];
          if (nd < dist[v]) {
            dist[v] = nd;
            prevEdge[v] = eid;
            if (!inQueue[v]) {
              queue.push(v);
              inQueue[v] = true;
            }
          }
        }
      }

      if (dist[sink] === Infinity) break;

      let augment = Infinity;
      for (let v = sink; v !== source; ) {
        const eid = prevEdge[v];
        augment = Math.min(augment, this.cap[eid] - this.flow[eid]);
        v = this.to[eid ^ 1];
      }
      for (let v = sink; v !== source; ) {
        const eid = prevEdge[v];
        this.flow[eid] += augment;
        this.flow[eid ^ 1] -= augment;
        v = this.to[eid ^ 1];
      }

      totalCost += augment * dist[sink];
      totalFlow += augment;
    }

    return { totalCost, totalFlow };
  }
}
