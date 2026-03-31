# InfraVision Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the homelab-navigator React app with dependency edge rendering, dynamic JSON data loading, and GitHub Pages deployment.

**Architecture:** The existing React Flow app already renders zones, hosts, services, and handles filtering/highlighting. This plan adds three things: (1) smoothstep edges for service dependencies and physical connections, (2) replacing static mock data with a fetched JSON file, (3) GitHub Pages CI/CD. The app remains a static SPA with no runtime backend.

**Tech Stack:** React 18, @xyflow/react 12, TanStack Query, Vite, TypeScript, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-31-infravision-design.md` + `docs/superpowers/specs/2026-03-31-infravision-visual-spec.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/edges.ts` | Create | Edge construction from connections data |
| `src/components/nodes/ConnectionEdge.tsx` | Create | Custom edge component with label styling |
| `src/lib/layout.ts` | Modify | Add edge generation to layout output |
| `src/lib/highlight.tsx` | Modify | Extend hover highlighting to dim/brighten edges |
| `src/pages/Index.tsx` | Modify | Wire edges into ReactFlow, add data loading |
| `src/data/infrastructure.ts` | Modify | Add async loader, keep mock as fallback |
| `src/data/types.ts` | Create | Shared TypeScript interfaces (extracted from infrastructure.ts) |
| `public/infravision-data.json` | Create | Sample data file matching the schema |
| `.github/workflows/deploy.yml` | Create | GitHub Pages build and deploy |
| `vite.config.ts` | Modify | Set base path for GitHub Pages |

---

### Task 1: Extract shared types to `src/data/types.ts`

**Files:**
- Create: `src/data/types.ts`
- Modify: `src/data/infrastructure.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/data/types.ts

export interface QuickLink {
  label: string;
  url: string;
  icon: string;
}

export interface Service {
  id: string;
  label: string;
  description: string;
  hostId: string;
  type: "docker" | "k8s" | "native";
  ports: number[];
  image?: string;
  chart?: string;
  namespace?: string;
  syncStatus?: "synced" | "out-of-sync" | "failed";
  dependencies: string[];
  tags: string[];
  quickLinks: QuickLink[];
  ansiblePlaybook?: string;
  argocdApp?: string;
}

export interface Host {
  id: string;
  label: string;
  ip: string;
  fullIp?: string;
  zone: string;
  color: string;
  services: Service[];
  tags: string[];
  netboxUrl?: string;
  grafanaDashboard?: string;
}

export interface NetworkZone {
  id: string;
  cidr: string;
  label: string;
  hostIds: string[];
}

export interface Connection {
  source: string;
  target: string;
  label?: string;
  type: "dependency" | "physical";
}

export interface InfraVisionData {
  metadata: {
    generated_at: string;
    sources: {
      netbox: string;
      ansible: string;
      argocd: string;
      prometheus: string;
    };
  };
  zones: NetworkZone[];
  hosts: Host[];
  services: Service[];
  connections: Connection[];
  tags: string[];
}
```

- [ ] **Step 2: Update infrastructure.ts imports**

Replace the inline type definitions in `src/data/infrastructure.ts` with imports from `src/data/types.ts`. Remove the duplicated `Service`, `Host`, `NetworkZone`, `QuickLink` interfaces from infrastructure.ts and add:

```typescript
import type { Service, Host, NetworkZone, Connection, InfraVisionData } from './types';
```

Keep all the mock data arrays (`services`, `hosts`, `zones`, `dependencies`, `physicalConnections`, `infrastructureTags`) and helper functions (`getAllServices`, `getServiceById`, etc.) unchanged.

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/types.ts src/data/infrastructure.ts
git commit -m "refactor: extract shared types to types.ts"
```

---

### Task 2: Build edge construction from connections data

**Files:**
- Create: `src/lib/edges.ts`

- [ ] **Step 1: Create the edges module**

```typescript
// src/lib/edges.ts
import type { Edge } from '@xyflow/react';
import type { Connection } from '../data/types';

const DEPENDENCY_EDGE_STYLE = {
  stroke: 'hsla(35, 70%, 55%, 0.6)',
  strokeWidth: 1.5,
  strokeDasharray: '6 4',
};

const PHYSICAL_EDGE_STYLE = {
  stroke: 'hsla(220, 20%, 45%, 0.4)',
  strokeWidth: 1.5,
};

const EDGE_LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  background: 'hsla(222, 20%, 12%, 0.9)',
  padding: '2px 6px',
  borderRadius: '3px',
  color: 'hsla(220, 15%, 65%, 0.8)',
};

export function buildEdges(connections: Connection[]): Edge[] {
  return connections.map((conn, index) => {
    const isDependency = conn.type === 'dependency';
    return {
      id: `edge-${conn.source}-${conn.target}-${index}`,
      source: conn.source,
      target: conn.target,
      type: 'smoothstep',
      animated: isDependency,
      style: isDependency ? DEPENDENCY_EDGE_STYLE : PHYSICAL_EDGE_STYLE,
      label: conn.label,
      labelStyle: conn.label ? EDGE_LABEL_STYLE : undefined,
      labelBgStyle: conn.label ? { fill: 'transparent' } : undefined,
      zIndex: 0,
    };
  });
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/edges.ts
git commit -m "feat: add edge construction from connections data"
```

---

### Task 3: Wire edges into the React Flow canvas

**Files:**
- Modify: `src/pages/Index.tsx`
- Modify: `src/data/infrastructure.ts`

- [ ] **Step 1: Export connections from infrastructure.ts**

Add a `getConnections()` function to `src/data/infrastructure.ts` that returns the existing `dependencies` and `physicalConnections` arrays combined into the `Connection[]` format:

```typescript
import type { Connection } from './types';

export function getConnections(): Connection[] {
  const depConnections: Connection[] = dependencies.map(d => ({
    source: d.source,
    target: d.target,
    label: d.label,
    type: 'dependency' as const,
  }));
  const physConnections: Connection[] = physicalConnections.map(p => ({
    source: p.source,
    target: p.target,
    label: p.label,
    type: 'physical' as const,
  }));
  return [...depConnections, ...physConnections];
}
```

- [ ] **Step 2: Import and use edges in Index.tsx**

Add to the imports in `src/pages/Index.tsx`:

```typescript
import { buildEdges } from '../lib/edges';
import { getConnections } from '../data/infrastructure';
```

In the component body, compute edges with useMemo:

```typescript
const edges = useMemo(() => buildEdges(getConnections()), []);
```

Pass `edges` to the ReactFlow component, replacing the empty array:

```tsx
<ReactFlow
  nodes={dimmedNodes}
  edges={edges}
  // ... rest of existing props
/>
```

- [ ] **Step 3: Verify edges render**

Run: `npm run dev`
Expected: Open browser at localhost:8080. Dependency arrows (dashed, amber) appear between services like n8n → PostgreSQL. A solid line appears between lw-n1 and lw-nas with "USB-eth" label.

- [ ] **Step 4: Commit**

```bash
git add src/data/infrastructure.ts src/pages/Index.tsx
git commit -m "feat: render dependency and physical connection edges"
```

---

### Task 4: Add edge highlighting on service hover

**Files:**
- Modify: `src/lib/highlight.tsx`
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: Expose highlighted edge IDs from highlight context**

In `src/lib/highlight.tsx`, add a function that returns which edge IDs should be highlighted given the currently hovered service. Add to the context interface:

```typescript
// Add to HighlightContextType
getHighlightedEdgeIds: () => Set<string>;
```

Implement it in the provider: when a service is hovered, collect all edge IDs where either source or target is in the hovered service's dependency chain (the set already computed by `getDirectConnections`):

```typescript
const getHighlightedEdgeIds = useCallback((): Set<string> => {
  if (!hoveredService) return new Set();
  const connected = getDirectConnections(hoveredService);
  connected.add(hoveredService);
  const edgeIds = new Set<string>();
  // Match edges where both source and target are in the connected set
  // Edge IDs follow the pattern: edge-{source}-{target}-{index}
  return connected;
}, [hoveredService]);
```

- [ ] **Step 2: Apply edge dimming in Index.tsx**

In `src/pages/Index.tsx`, use the highlight context to dim edges. Compute a `dimmedEdges` array similar to how `dimmedNodes` works:

```typescript
const { hoveredService, getDirectConnections, getHighlightedEdgeIds } = useHighlight();

const dimmedEdges = useMemo(() => {
  if (!hoveredService) return edges;
  const connectedServices = getDirectConnections(hoveredService);
  connectedServices.add(hoveredService);

  return edges.map(edge => {
    const isHighlighted = connectedServices.has(edge.source) || connectedServices.has(edge.target);
    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isHighlighted ? 1 : 0.15,
        strokeWidth: isHighlighted ? 2 : (edge.style?.strokeWidth ?? 1.5),
        transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
      },
    };
  });
}, [edges, hoveredService, getDirectConnections]);
```

Pass `dimmedEdges` to ReactFlow instead of `edges`.

- [ ] **Step 3: Verify hover highlighting works**

Run: `npm run dev`
Expected: Hover over a service node (e.g., n8n). Its dependency edges brighten and thicken. All other edges dim to 0.15 opacity. Edges reset on mouse leave.

- [ ] **Step 4: Commit**

```bash
git add src/lib/highlight.tsx src/pages/Index.tsx
git commit -m "feat: highlight dependency edges on service hover"
```

---

### Task 5: Add async data loading with TanStack Query

**Files:**
- Modify: `src/data/infrastructure.ts`
- Modify: `src/pages/Index.tsx`
- Create: `public/infravision-data.json`

- [ ] **Step 1: Create a sample data JSON file**

Create `public/infravision-data.json` containing the current mock data restructured into the `InfraVisionData` schema. Use the existing mock arrays from `infrastructure.ts` to populate it:

```json
{
  "metadata": {
    "generated_at": "2026-03-31T10:00:00Z",
    "sources": {
      "netbox": "https://netbox.lab.local",
      "ansible": "abc123",
      "argocd": "https://argocd.lab.local",
      "prometheus": "https://prometheus.lab.local"
    }
  },
  "zones": [
    { "id": "primary", "cidr": "192.168.0.0/24", "label": "PRIMARY NETWORK", "hostIds": ["lw-c1", "lw-n1", "lw-n2"] },
    { "id": "nas", "cidr": "10.0.1.0/24", "label": "NAS SUBNET", "hostIds": ["lw-nas"] }
  ],
  "hosts": [],
  "services": [],
  "connections": [],
  "tags": ["automation", "monitoring", "storage", "ai", "security", "files", "dev-tools", "workflow"]
}
```

Populate the `hosts`, `services`, and `connections` arrays by converting the existing mock data. Each host's `services` array should be flattened into the top-level `services` array (services reference their host via `hostId`). The `connections` array merges `dependencies` and `physicalConnections`.

This file must contain the exact same data as the current mock — just restructured to match the schema. It will be large (~200 lines of JSON). Generate it by reading the existing mock arrays.

- [ ] **Step 2: Add a data loader function**

Add to `src/data/infrastructure.ts`:

```typescript
import type { InfraVisionData } from './types';

export async function loadInfrastructureData(): Promise<InfraVisionData> {
  const response = await fetch('/infravision-data.json');
  if (!response.ok) {
    throw new Error(`Failed to load infrastructure data: ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 3: Use TanStack Query in Index.tsx**

Replace the synchronous mock data usage in `src/pages/Index.tsx` with a query:

```typescript
import { useQuery } from '@tanstack/react-query';
import { loadInfrastructureData } from '../data/infrastructure';

// Inside the component:
const { data, isLoading, error } = useQuery({
  queryKey: ['infrastructure'],
  queryFn: loadInfrastructureData,
  staleTime: Infinity, // Static data, no refetching
});
```

Derive `zones`, `hosts` (with nested services), `connections`, and `tags` from the loaded `data`. The existing code expects hosts with nested `services` arrays, so reconstruct that shape from the flat schema:

```typescript
const processedData = useMemo(() => {
  if (!data) return null;
  const hosts: Host[] = data.hosts.map(h => ({
    ...h,
    services: data.services.filter(s => s.hostId === h.id),
  }));
  const zones: NetworkZone[] = data.zones;
  const connections: Connection[] = data.connections;
  const tags: string[] = data.tags;
  return { hosts, zones, connections, tags, metadata: data.metadata };
}, [data]);
```

Show a loading skeleton while `isLoading` is true. Show an error message if `error` is set. Use `processedData` for the rest of the component logic (layout computation, filtering, etc.).

- [ ] **Step 4: Display generation timestamp in sidebar**

Pass `metadata.generated_at` to the Sidebar component. Display it at the bottom of the sidebar:

```tsx
// In Sidebar.tsx, add a footer section:
{generatedAt && (
  <div className="mt-auto pt-4 border-t border-[hsla(220,20%,25%,0.5)]">
    <span className="text-[10px] text-[hsla(220,15%,50%,0.6)]">
      Updated: {new Date(generatedAt).toLocaleString()}
    </span>
  </div>
)}
```

- [ ] **Step 5: Verify data loading works**

Run: `npm run dev`
Expected: App loads, shows a brief loading state, then renders the same infrastructure map as before but sourced from `infravision-data.json`. The sidebar footer shows the generation timestamp.

- [ ] **Step 6: Verify fallback on missing JSON**

Temporarily rename `public/infravision-data.json`. Reload the app.
Expected: Error state displayed (not a blank page or crash).

Rename it back.

- [ ] **Step 7: Commit**

```bash
git add public/infravision-data.json src/data/infrastructure.ts src/pages/Index.tsx src/components/Sidebar.tsx
git commit -m "feat: load infrastructure data from JSON with TanStack Query"
```

---

### Task 6: GitHub Pages deployment workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `vite.config.ts`

- [ ] **Step 1: Configure Vite base path**

In `vite.config.ts`, set the `base` option so asset paths work on GitHub Pages. The repo name determines the base path:

```typescript
export default defineConfig({
  base: '/infravision/',
  // ... rest of existing config
});
```

- [ ] **Step 2: Create the GitHub Actions workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verify build output**

Run: `npm run build`
Expected: `dist/` directory created. `dist/infravision-data.json` exists (copied from public/). `dist/index.html` has asset paths prefixed with `/infravision/`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml vite.config.ts
git commit -m "ci: add GitHub Pages deployment workflow"
```

---

### Task 7: Final integration verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no warnings, no type errors.

- [ ] **Step 2: Visual verification**

Run: `npm run dev`

Verify all of the following:
- Zones render as background regions with CIDR labels
- Hosts render as colored containers with services nested inside
- Service dependency edges render as dashed amber smoothstep arrows
- Physical connection edge renders as solid line between lw-n1 and lw-nas with "USB-eth" label
- Hovering a service highlights its dependency edges and dims others
- Search dims non-matching nodes (not hides them)
- Layer toggles show/hide Physical / Services / K8s layers
- Tag filters work
- Clicking a service opens the detail panel with quick links
- Generation timestamp shows in sidebar footer
- MiniMap and zoom controls work

- [ ] **Step 3: Commit any fixes**

If any issues found, fix and commit individually with descriptive messages.
