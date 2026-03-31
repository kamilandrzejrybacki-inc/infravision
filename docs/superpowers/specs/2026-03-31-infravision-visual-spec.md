# InfraVision — Design Specification for Readable Infrastructure Diagrams

> **Purpose**: A strict layout and styling guide for Claude Code to produce clear, non-overlapping, readable infrastructure maps using React Flow. Follow every rule literally.

---

## 1. GLOBAL LAYOUT CONSTANTS

All positions are in React Flow coordinate space (pixels). **Never** use `fitView` alone — always set explicit positions.

```
SIDEBAR_WIDTH        = 240px (fixed, outside React Flow)
DETAIL_PANEL_WIDTH   = 320px (fixed, slides from right)
CANVAS_PADDING       = 80px (minimum empty space around all content)

NETWORK_ZONE_PADDING = 60px (inner padding of zone background)
NETWORK_ZONE_GAP     = 80px (vertical gap between zone backgrounds)

HOST_NODE_WIDTH      = 260px (fixed width for every host container)
HOST_NODE_MIN_HEIGHT = 180px (grows with service count)
HOST_GAP_X           = 60px (horizontal gap between host containers)
HOST_GAP_Y           = 40px (vertical gap if hosts wrap to next row)

SERVICE_NODE_HEIGHT   = 32px (each service row inside a host)
SERVICE_NODE_PADDING  = 12px (vertical spacing between service rows)
SERVICE_LEFT_INDENT   = 16px (from host container left edge)

K8S_CLUSTER_INDENT    = 20px (nested inside host, offset from host border)
K8S_NAMESPACE_GAP     = 12px
```

### Critical Rule: No Overlap

Before rendering, compute total bounding box of each host:
```
hostHeight = HEADER_HEIGHT + (serviceCount × (SERVICE_NODE_HEIGHT + SERVICE_NODE_PADDING)) + BOTTOM_PADDING
```
Where `HEADER_HEIGHT = 48px`, `BOTTOM_PADDING = 20px`.

Place hosts left-to-right within their network zone. If `totalHostsWidth > zoneWidth`, wrap to next row with `HOST_GAP_Y`.

---

## 2. NETWORK ZONE BACKGROUNDS

Each subnet is a **React Flow group node** (not a regular node). Render as a translucent rounded rectangle behind host nodes.

| Zone | Background | Border | Label |
|------|-----------|--------|-------|
| 192.168.0.0/24 — Primary | `hsla(220, 15%, 18%, 0.4)` | `1px solid hsla(220, 20%, 35%, 0.5)` | Top-left, 11px, `hsla(220, 20%, 65%, 0.8)` |
| 10.0.1.0/24 — NAS Subnet | `hsla(220, 12%, 15%, 0.4)` | `1px solid hsla(220, 15%, 30%, 0.5)` | Top-left, 11px |

**Zone sizing**: `width = (hostCount × HOST_NODE_WIDTH) + ((hostCount - 1) × HOST_GAP_X) + (2 × NETWORK_ZONE_PADDING)`. Height = tallest host + `2 × NETWORK_ZONE_PADDING`.

---

## 3. HOST CONTAINER NODES

Each host is a React Flow **group node** with `type: 'group'`. Services are child nodes with `parentId` set.

### Host Color Palette (border-left: 3px solid)

| Host | Border Color | Rationale |
|------|-------------|-----------|
| lw-c1 | `hsl(0, 65%, 55%)` | Red — cluster node, critical |
| lw-n1 | `hsl(35, 80%, 55%)` | Amber — primary services |
| lw-n2 | `hsl(160, 50%, 50%)` | Teal — secondary services |
| lw-nas | `hsl(220, 50%, 60%)` | Blue — storage |
| lw-main | `hsl(270, 45%, 60%)` | Purple — management |

### Host Node Styles

```css
.host-container {
  background: hsla(222, 20%, 14%, 0.95);
  border: 1px solid hsla(220, 20%, 30%, 0.6);
  border-left: 3px solid var(--host-color);
  border-radius: 8px;
  width: 260px;
  padding: 0;
}

.host-header {
  padding: 10px 14px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--host-color);
  border-bottom: 1px solid hsla(220, 15%, 25%, 0.5);
  display: flex;
  justify-content: space-between;
}

.host-ip {
  font-size: 11px;
  font-weight: 400;
  color: hsla(220, 15%, 55%, 0.8);
  margin-left: 6px;
}
```

---

## 4. SERVICE NODES (inside hosts)

Services are **child nodes** of their host group. Position them using relative coordinates:

```
x: SERVICE_LEFT_INDENT (16)
y: HEADER_HEIGHT + (index × (SERVICE_NODE_HEIGHT + SERVICE_NODE_PADDING))
```

### Service Node Styles

```css
.service-node {
  height: 32px;
  width: calc(100% - 32px);  /* HOST_WIDTH - 2×indent */
  padding: 6px 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: hsla(0, 0%, 90%, 0.9);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.service-node:hover {
  background: hsla(220, 20%, 25%, 0.5);
}

.service-node--selected {
  background: hsla(220, 30%, 28%, 0.6);
  outline: 1px solid hsla(210, 50%, 55%, 0.4);
}
```

**Never** render services as free-floating nodes. They must always be children of a host group.

---

## 5. K8s LAYER (nested inside lw-c1)

The K3s cluster is a **sub-group** inside lw-c1. Render it as an indented container:

```
K3s cluster container:
  x: K8S_CLUSTER_INDENT (20px from lw-c1 left)
  y: below host header
  width: HOST_NODE_WIDTH - (2 × K8S_CLUSTER_INDENT)
  border-left: 2px solid hsla(200, 60%, 50%, 0.6)
  background: hsla(200, 20%, 16%, 0.4)
  label: "K3s cluster" in 11px, hsla(200, 50%, 65%, 0.8)
```

K8s workloads (ArgoCD, n8n-workers, prefect-etl, github-runners) are listed inside with the same service node styling but with a tree-branch prefix character `├` or `└` to indicate hierarchy.

**Sync status indicator**: A small 8px circle to the left of each Helm release:
- Synced: `hsl(145, 60%, 50%)`
- Out of sync: `hsl(40, 80%, 55%)`
- Failed: `hsl(0, 65%, 55%)`

---

## 6. EDGES (dependency arrows)

### Edge Types

| Type | Style | Color | Use |
|------|-------|-------|-----|
| Service dependency | Animated dashed | `hsla(35, 70%, 55%, 0.6)` | e.g. n8n → PostgreSQL |
| Host-to-host link | Solid, thin | `hsla(220, 20%, 45%, 0.4)` | Physical connections |
| USB-eth adapter | Labeled edge | `hsla(35, 70%, 55%, 0.7)` | Special physical link |

### Edge Rules

1. **Use `smoothstep` edge type** — never `straight` or `default` (bezier). Smoothstep routes around nodes cleanly.
2. **Edge labels** (e.g., "USB-eth"): `font-size: 10px`, background `hsla(222, 20%, 12%, 0.9)`, padding `2px 6px`, border-radius `3px`.
3. **Animated edges**: Use `animated: true` for dependency arrows only. Dash pattern: `strokeDasharray: '6 4'`.
4. **Source/target handles**: Place handles on the side closest to the target. For services inside hosts, use the host container's edge, not the service node itself.
5. **Z-index**: Edges must render BELOW nodes. Set `zIndex: 0` on edges.

### Dependency Highlight on Hover

When hovering a service node:
- All edges in its dependency chain: opacity → 1, strokeWidth → 2
- All other edges: opacity → 0.15
- All non-related nodes: opacity → 0.4
- Reset on mouse leave (transition: 0.2s ease)

---

## 7. POSITIONING ALGORITHM

**Do NOT rely on auto-layout.** Use explicit coordinates calculated as follows:

```typescript
function layoutHosts(hosts: Host[], zone: Zone): PositionedHost[] {
  const sorted = hosts.sort((a, b) => b.services.length - a.services.length);
  let x = zone.x + NETWORK_ZONE_PADDING;
  let y = zone.y + NETWORK_ZONE_PADDING + ZONE_LABEL_HEIGHT;
  let rowMaxHeight = 0;
  const maxRowWidth = zone.maxWidth - (2 * NETWORK_ZONE_PADDING);

  return sorted.map(host => {
    const height = HEADER_HEIGHT + (host.services.length * (SERVICE_NODE_HEIGHT + SERVICE_NODE_PADDING)) + BOTTOM_PADDING;

    if (x + HOST_NODE_WIDTH > zone.x + maxRowWidth) {
      x = zone.x + NETWORK_ZONE_PADDING;
      y += rowMaxHeight + HOST_GAP_Y;
      rowMaxHeight = 0;
    }

    const pos = { x, y };
    x += HOST_NODE_WIDTH + HOST_GAP_X;
    rowMaxHeight = Math.max(rowMaxHeight, height);

    return { ...host, position: pos, height };
  });
}
```

### Zone Positions

```
PRIMARY_ZONE:  { x: 0, y: 0, maxWidth: 1000 }
NAS_ZONE:      { x: 0, y: PRIMARY_ZONE.bottom + NETWORK_ZONE_GAP }
```

---

## 8. DETAIL PANEL

Right-side panel, `320px` wide, slides in with `transform: translateX` transition (0.25s ease).

### Structure

```
┌─────────────────────────┐
│ SERVICE DETAIL     [✕]  │  ← 11px label, muted
│                         │
│ n8n                     │  ← 22px, bold, white
│ Workflow automation     │  ← 13px, muted-foreground
│ platform                │
│                         │
│ ─────────────────────── │  ← separator
│                         │
│ HOST        lw-n1       │  ← key-value pairs
│ TYPE        Docker      │     key: 11px, uppercase, muted
│ PORTS       5678        │     value: 13px, foreground
│ IMAGE       docker...   │
│                         │
│ DEPENDS ON              │  ← 11px section header
│  → PostgreSQL           │     13px, clickable links
│  → Redis                │
│                         │
│ TAGS                    │
│  [automation] [workflow]│  ← badge chips
│                         │
│ QUICK LINKS             │
│  🌐 Open Web UI         │  ← icon + link, 13px
│  📊 Grafana Dashboard   │
│  📦 NetBox Entry        │
└─────────────────────────┘
```

### Panel Styles

```css
.detail-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 320px;
  background: hsl(222, 25%, 10%);
  border-left: 1px solid hsla(220, 20%, 25%, 0.6);
  padding: 24px 20px;
  overflow-y: auto;
  z-index: 50;
}

.detail-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsla(220, 15%, 55%, 0.8);
  margin-bottom: 4px;
}

.detail-value {
  font-size: 13px;
  color: hsla(0, 0%, 92%, 0.95);
  font-family: 'JetBrains Mono', monospace;
}
```

---

## 9. SIDEBAR

Fixed `240px` width. Dark background `hsl(222, 25%, 8%)`.

### Search Bar
- Full width minus padding
- `background: hsla(220, 15%, 18%, 0.6)`
- `border: 1px solid hsla(220, 15%, 25%, 0.5)`
- Placeholder: "Search services, hosts..." in `hsla(220, 15%, 45%, 0.6)`
- On input: filter nodes. Matching nodes stay full opacity; non-matching dim to `opacity: 0.2`

### Layer Toggles
Three buttons, full width, stacked:
| Layer | Active BG | Text |
|-------|----------|------|
| Physical | `hsl(220, 50%, 45%)` | white |
| Services | `hsl(25, 70%, 50%)` | white |
| K8s | `hsl(160, 45%, 42%)` | white |

Inactive: `hsla(220, 15%, 20%, 0.5)` with muted text. Border-radius: `6px`. Height: `34px`. Gap: `6px`.

### Tag Filter Chips
Wrap in a flex-wrap container. Each chip:
- `padding: 4px 10px`
- `border-radius: 12px`
- `font-size: 11px`
- Inactive: `background: hsla(220, 15%, 22%, 0.6)`, `color: hsla(220, 10%, 60%, 0.8)`
- Active: `background: hsla(210, 40%, 35%, 0.7)`, `color: white`, `border: 1px solid hsla(210, 50%, 50%, 0.5)`

### Host List
Each host entry: colored square indicator (8×8px, matching host border color) + hostname in 13px.

---

## 10. DARK THEME COLOR SYSTEM

**Base palette** (use these, don't invent new ones):

```css
--canvas-bg:        hsl(222, 25%, 10%);
--surface-1:        hsl(222, 20%, 14%);
--surface-2:        hsl(222, 18%, 18%);
--border-subtle:    hsla(220, 20%, 30%, 0.5);
--border-strong:    hsla(220, 20%, 40%, 0.6);
--text-primary:     hsla(0, 0%, 92%, 0.95);
--text-secondary:   hsla(220, 15%, 65%, 0.8);
--text-muted:       hsla(220, 15%, 50%, 0.6);
--accent-red:       hsl(0, 65%, 55%);
--accent-amber:     hsl(35, 80%, 55%);
--accent-teal:      hsl(160, 50%, 50%);
--accent-blue:      hsl(220, 50%, 60%);
--accent-purple:    hsl(270, 45%, 60%);
```

---

## 11. TYPOGRAPHY

| Role | Font | Size | Weight | Color |
|------|------|------|--------|-------|
| Host name | JetBrains Mono | 14px | 600 | host accent color |
| Host IP | JetBrains Mono | 11px | 400 | --text-muted |
| Service name | Inter | 13px | 400 | --text-primary |
| Zone label | Inter | 11px | 500 | --text-secondary |
| Detail heading | Inter | 22px | 700 | --text-primary |
| Detail key | Inter | 11px | 500 | --text-muted, uppercase |
| Detail value | JetBrains Mono | 13px | 400 | --text-primary |
| Sidebar section | Inter | 11px | 600 | --text-muted, uppercase |

---

## 12. ANTI-PATTERNS — NEVER DO THESE

1. ❌ **Never use `fitView` without explicit positions** — nodes will pile up
2. ❌ **Never place services as free-floating nodes** — always nest inside host groups
3. ❌ **Never use absolute pixel positions without the layout algorithm** — manual coords drift
4. ❌ **Never use bezier edges for dependency arrows** — they overlap with nodes; use smoothstep
5. ❌ **Never make host containers auto-width** — fixed 260px prevents layout collapse
6. ❌ **Never render more than ~8 services per host without scrolling** — add internal scroll at 8+
7. ❌ **Never put text smaller than 11px** — unreadable at default zoom
8. ❌ **Never use bright/saturated backgrounds** — only the accents should pop
9. ❌ **Never auto-layout with dagre/elk for this use case** — the nested group structure breaks auto-layout; use the explicit algorithm above
10. ❌ **Never hardcode positions in the data file** — compute from the layout algorithm at render time

---

## 13. DATA STRUCTURE

```typescript
interface Host {
  id: string;           // "lw-c1"
  label: string;        // "lw-c1"
  ip: string;           // ".107"
  zone: string;         // "primary" | "nas"
  color: string;        // from host palette
  services: Service[];
  tags: string[];
}

interface Service {
  id: string;           // "n8n"
  label: string;        // "n8n"
  description: string;  // "Workflow automation platform"
  hostId: string;       // "lw-n1"
  type: "docker" | "k8s" | "native";
  ports: number[];
  image?: string;       // "docker.n8n.io/n8nio/n8n"
  dependencies: string[]; // service IDs
  tags: string[];
  quickLinks: QuickLink[];
}

interface QuickLink {
  label: string;        // "Open Web UI"
  url: string;
  icon: string;         // emoji or lucide icon name
}

interface NetworkZone {
  id: string;
  cidr: string;         // "192.168.0.0/24"
  label: string;        // "PRIMARY NETWORK"
  hosts: string[];      // host IDs in this zone
}

interface Dependency {
  source: string;       // service ID
  target: string;       // service ID
  label?: string;       // optional edge label
}
```

---

## 14. IMPLEMENTATION CHECKLIST

When Claude Code implements this, verify each item:

- [ ] Every host container is exactly 260px wide
- [ ] Services are nested children (parentId set) — not floating
- [ ] At least 60px gap between host containers
- [ ] Zone backgrounds are behind hosts (lower z-index)
- [ ] Edges use `smoothstep` type
- [ ] No node overlaps at default zoom (check bounding boxes)
- [ ] Detail panel slides in from right, doesn't push canvas
- [ ] Search dims non-matching nodes, doesn't hide them
- [ ] Layer toggles hide/show entire node categories
- [ ] Hover on service highlights dependency chain
- [ ] All fonts loaded (JetBrains Mono + Inter)
- [ ] Canvas background matches `--canvas-bg`
- [ ] No text below 11px
- [ ] Host heights computed dynamically from service count

