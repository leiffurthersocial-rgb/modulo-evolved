"use client";

import { useMemo, useState } from "react";
import { Crosshair, GitBranch, Skull } from "lucide-react";
import { DEEP_TREE, type DeepNode } from "@/engine/species/phylo";
import { SPECIES } from "@/engine/species/roster";
import type { Lineage } from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useUi } from "@/state/ui-store";
import { Button } from "@/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { InfoTip } from "@/ui/info-tip";
import { Workspace } from "../labs/workspace";

export function PhylogenyView() {
  const [tab, setTab] = useState("live");
  const totals = useWorld((s) => s.totals);
  return (
    <Workspace
      title="Phylogeny"
      subtitle={`${totals.speciations ?? 0} speciation events · ${totals.extinctions ?? 0} extinctions so far`}
      actions={
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="live">
              <GitBranch /> Live lineages
            </TabsTrigger>
            <TabsTrigger value="deep">Deep time</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="live">
          <LiveTree />
        </TabsContent>
        <TabsContent value="deep">
          <DeepTree />
        </TabsContent>
      </Tabs>
    </Workspace>
  );
}

const ROW = 30;
const LEFT = 210;
const W = 980;

/** Order: roots by deep-tree tip order, each followed by its descendants (DFS). */
function useOrderedLineages() {
  const lineages = useWorld((s) => s.lineages);
  const counts = useWorld((s) => s.lineageCounts);
  return useMemo(() => {
    const tipOrder: SpeciesId[] = [];
    const walk = (n: DeepNode) => (n.species ? tipOrder.push(n.species) : n.children?.forEach(walk));
    walk(DEEP_TREE);
    const relevant = lineages.filter((l) => l.everAlive || (counts[l.id] ?? 0) > 0);
    const kids = new Map<number | null, Lineage[]>();
    for (const l of relevant) {
      const p = l.parent !== null && relevant.some((x) => x.id === l.parent) ? l.parent : null;
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p)!.push(l);
    }
    const out: { l: Lineage; depth: number }[] = [];
    const visit = (l: Lineage, depth: number) => {
      out.push({ l, depth });
      for (const c of (kids.get(l.id) ?? []).sort((a, b) => a.bornDay - b.bornDay)) visit(c, depth + 1);
    };
    (kids.get(null) ?? [])
      .sort((a, b) => tipOrder.indexOf(a.species) - tipOrder.indexOf(b.species))
      .forEach((r) => visit(r, 0));
    return out;
  }, [lineages, counts]);
}

function LiveTree() {
  const rows = useOrderedLineages();
  const counts = useWorld((s) => s.lineageCounts);
  const day = useWorld((s) => s.day);
  const [sel, setSel] = useState<number | null>(null);
  const end = Math.max(30, day);
  const x = (d: number) => LEFT + (d / end) * (W - LEFT - 40);
  const rowOf = new Map(rows.map((r, i) => [r.l.id, i]));
  const maxCount = Math.max(1, ...Object.values(counts));
  const selected = rows.find((r) => r.l.id === sel)?.l;
  const H = rows.length * ROW + 40;

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label="Lineage tree over simulated time"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={x(end * f)} x2={x(end * f)} y1={10} y2={H - 20} stroke="#1f2a35" />
              <text x={x(end * f)} y={H - 6} fontSize={11} fill="#6b7886" textAnchor="middle">
                {((end * f) / 365).toFixed(1)}y
              </text>
            </g>
          ))}
          {rows.map(({ l, depth }, i) => {
            const y = 20 + i * ROW;
            const n = counts[l.id] ?? 0;
            const stop = l.extinctDay ?? day;
            const thick = 2 + 10 * Math.sqrt(n / maxCount);
            const pRow = l.parent !== null ? rowOf.get(l.parent) : undefined;
            return (
              <g key={l.id} className="cursor-pointer" onClick={() => setSel(l.id)}>
                <rect
                  x={0}
                  y={y - ROW / 2}
                  width={W}
                  height={ROW}
                  fill={sel === l.id ? "#131a22" : "transparent"}
                />
                {pRow !== undefined && (
                  <line
                    x1={x(l.bornDay)}
                    x2={x(l.bornDay)}
                    y1={20 + pRow * ROW}
                    y2={y}
                    stroke={l.color}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                <line
                  x1={x(l.bornDay)}
                  x2={x(stop)}
                  y1={y}
                  y2={y}
                  stroke={l.color}
                  strokeWidth={l.extinctDay !== null ? 2 : thick}
                  strokeLinecap="round"
                  opacity={l.extinctDay !== null ? 0.45 : 0.9}
                />
                {l.extinctDay !== null && (
                  <text x={x(stop) + 6} y={y + 4} fontSize={12} fill="#f87171">
                    †
                  </text>
                )}
                <text
                  x={8 + depth * 12}
                  y={y + 4}
                  fontSize={12}
                  fill={l.extinctDay !== null ? "#6b7886" : "#e6edf3"}
                  fontStyle={l.parent === null ? "normal" : "italic"}
                >
                  {l.parent === null
                    ? SPECIES[l.species].name
                    : l.name.length > 26
                      ? `${l.name.slice(0, 25)}…`
                      : l.name}
                </text>
                {l.extinctDay === null && (
                  <text x={x(stop) + 8} y={y + 4} fontSize={11} fill="#9aa7b4" fontFamily="var(--font-mono)">
                    {n}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {rows.length === 0 && <p className="text-sm text-fg-muted">No lineages yet.</p>}
      </div>
      <aside className="space-y-3">
        <p className="flex items-center gap-1 text-sm text-fg-muted">
          How splits are detected
          <InfoTip title="Speciation detection" side="left">
            Every 30 days each lineage is sampled; animals closer than 0.5 in allele-sharing distance are
            linked into clusters. When two big clusters stay more than 0.6 apart (hybrids would be largely
            infertile) for two checks in a row, the smaller one becomes a new species. Isolation (islands!),
            drift and mutation drive it — try the Archipelago scenario.
          </InfoTip>
        </p>
        {selected ? (
          <LineageCard l={selected} count={counts[selected.id] ?? 0} />
        ) : (
          <p className="text-sm text-fg-subtle">Tap a lineage for details.</p>
        )}
      </aside>
    </div>
  );
}

function LineageCard({ l, count }: { l: Lineage; count: number }) {
  const lineages = useWorld((s) => s.lineages);
  const parent = l.parent !== null ? lineages[l.parent] : null;
  const follow = () => {
    const member = [...sim.bodies.values()].find((b) => b.lineage === l.id);
    if (!member) return;
    useWorld.getState().follow(member.id);
    useUi.getState().setDockTab("inspector");
  };
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-4">
      <p className="text-base font-semibold italic">{l.name}</p>
      <p className="text-xs text-fg-muted">{SPECIES[l.species].name} lineage</p>
      <dl className="grid grid-cols-2 gap-1 text-xs">
        <dt className="text-fg-subtle">Arose</dt>
        <dd>{l.bornDay === 0 ? "founding population" : `year ${(l.bornDay / 365).toFixed(1)}`}</dd>
        <dt className="text-fg-subtle">From</dt>
        <dd className="italic">{parent?.name ?? "—"}</dd>
        <dt className="text-fg-subtle">Status</dt>
        <dd>
          {l.extinctDay !== null ? (
            <span className="text-danger">extinct in year {(l.extinctDay / 365).toFixed(1)}</span>
          ) : (
            `${count} alive`
          )}
        </dd>
      </dl>
      {l.extinctDay === null ? (
        <Button size="sm" className="w-full" onClick={follow}>
          <Crosshair /> Follow a member
        </Button>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <Skull className="size-3.5" /> No survivors
        </p>
      )}
    </div>
  );
}

function DeepTree() {
  const counts = useWorld((s) => s.speciesCounts);
  const lineages = useWorld((s) => s.lineages);
  const layout = useMemo(() => {
    const tips: DeepNode[] = [];
    const walk = (n: DeepNode) => (n.species ? tips.push(n) : n.children?.forEach(walk));
    walk(DEEP_TREE);
    const y = new Map<DeepNode, number>();
    tips.forEach((t, i) => y.set(t, 24 + i * 30));
    const place = (n: DeepNode): number => {
      if (y.has(n)) return y.get(n)!;
      const ys = n.children!.map(place);
      const v = (Math.min(...ys) + Math.max(...ys)) / 2;
      y.set(n, v);
      return v;
    };
    place(DEEP_TREE);
    return { tips, y };
  }, []);
  const X0 = 30;
  const X1 = 640;
  const x = (age: number) => X0 + (1 - age / DEEP_TREE.age) * (X1 - X0);
  const H = layout.tips.length * 30 + 40;
  const edges: React.ReactNode[] = [];
  const draw = (n: DeepNode) => {
    for (const c of n.children ?? []) {
      const py = layout.y.get(n)!;
      const cy = layout.y.get(c)!;
      edges.push(
        <path
          key={`${n.name}-${c.name}`}
          d={`M${x(n.age)},${py} V${cy} H${x(c.age)}`}
          fill="none"
          stroke="#2c3a48"
          strokeWidth={1.5}
        />,
      );
      draw(c);
    }
    if (n.children && (n.age >= 230 || ["Aves", "Placentalia", "Carnivora"].includes(n.name)))
      edges.push(
        <text key={`l-${n.name}`} x={x(n.age) + 4} y={layout.y.get(n)! - 4} fontSize={9} fill="#6b7886">
          {n.name} · {n.age} Mya
        </text>,
      );
  };
  draw(DEEP_TREE);
  return (
    <div className="space-y-3 p-4">
      <p className="max-w-2xl text-sm text-fg-muted">
        The real evolutionary relationships of the roster (divergence times from TimeTree). Splice Lab costs
        scale with these distances; live speciation events in your world graft onto these tips.
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label="Deep-time phylogeny of the species roster"
        >
          {[465, 300, 200, 100, 0].map((a) => (
            <g key={a}>
              <line x1={x(a)} x2={x(a)} y1={10} y2={H - 20} stroke="#131a22" />
              <text x={x(a)} y={H - 6} fontSize={10} fill="#6b7886" textAnchor="middle">
                {a} Mya
              </text>
            </g>
          ))}
          {edges}
          {layout.tips.map((t) => {
            const sp = SPECIES[t.species!];
            const n = counts[t.species!] ?? 0;
            const branches = lineages.filter((l) => l.species === t.species && l.parent !== null).length;
            const yy = layout.y.get(t)!;
            return (
              <g key={t.name} opacity={n > 0 ? 1 : 0.4}>
                <circle cx={x(0)} cy={yy} r={5} fill={sp.color} />
                <text x={x(0) + 12} y={yy + 4} fontSize={12} fill="#e6edf3">
                  {sp.name}{" "}
                  <tspan fill="#6b7886" fontStyle="italic">
                    {sp.latin}
                  </tspan>
                </text>
                <text
                  x={W - 10}
                  y={yy + 4}
                  fontSize={11}
                  fill="#9aa7b4"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {n > 0 ? `${n} alive` : "absent"}
                  {branches ? ` · +${branches} new` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
