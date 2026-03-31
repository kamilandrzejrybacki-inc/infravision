# InfraVision Visual Design Specification
**Date:** 2026-03-31  
**Author:** frontend-design agent  
**Status:** Authoritative reference for all UI implementation

---

## 1. Reference Image Analysis

### Positive References — What to Absorb

**Wireframe Dashboard (justinmind):**  
A monochrome, utility-first dashboard. Narrow icon-only left rail, wide horizontal nav bar, stat cards on a clean top row with visible numeric hierarchy, charts below with proper breathing room. The absence of color is not a limitation — it makes structure visible. Every element earns its place. No decorative chrome. This teaches: *hierarchy and structure are the aesthetic.*

**Weather Dashboard (justinmind/dark):**  
True dark (near-black) sidebar bleeds into deep charcoal content area. No hard borders between regions — spacing does the separation. Rounded card clusters sit on the dark field like islands. Temperature numbers are large, confident, readable at a glance. The calm comes from *confident emptiness* — generous padding, nothing fighting for attention.

**Physical Infrastructure Design (medium/JPEG) — Primary Influence:**  
The standout. An architectural drawing document on warm parchment: precise isometric geometry, structured column text, numbered section labels as small superscript markers ("7"), dashed guide lines as structural decoration, a single editorial quote at the bottom. The aesthetic is a *technical document that takes pride in itself* — organized, authored, yours. This is exactly "mine, technical, organized." The key insight: **infrastructure should look like it was made by a careful engineer, not assembled from a UI kit.**

### Negative References — What to Reject

**Holori cloud diagram:**  
Purple-to-blue gradient sidebar. Rainbow icon tiles. Gradient toolbar. Colorful node squares. This is "impressively designed" in the SaaS startup sense — it telegraphs "enterprise product" rather than "personal creation." Avoid gradient backgrounds, avoid colorful icon tiles arranged in grids, avoid the purple/cyan/blue gradient palette.

**AWS architecture diagram:**  
Stock thick-bordered icon boxes (orange, green, blue), generic light-blue group containers, anonymous arrangement. Technically accurate but could belong to anyone. No authorship. Avoid: thick colored icon squares as primary node representation, light-colored group containers, generic service icon tiles as the main visual language.

### Core Insight

The target aesthetic is **technical document, not dashboard product**. Think: a careful engineer's printed infrastructure map that happens to be interactive. Organized like a schematic, calm like a blueprint, personal because every element reflects intentional choice.

---

## 2. Aesthetic Direction

**Name:** Schematic Calm  
**Tone:** Authoritative, minimal, authored — like infrastructure documentation you're proud to print  
**Differentiator:** The one thing to remember is the *quiet confidence* — no elements performing, nothing glowing or animating for attention. When everything is at rest, the canvas reads like a map. When you hover, it reveals its intelligence.

**Do not converge on:** glowing accents, glassmorphism cards, gradient sidebars, colorful icon tiles, the cyan/purple/blue AI palette.

---

## 3. Color Palette

### Philosophy
Keep the existing navy base — it's working. Refine it toward *slightly warmer and more saturated* to feel less generic. Reduce the number of active colors in chrome; let host accents do the work of color. All chrome (sidebar, panels, canvas) uses a tightly controlled near-monochrome palette with a single blue-steel tint.

### Base Palette (CSS Custom Properties — exact HSL values)

```css
/* Canvas & Backgrounds */
--iv-canvas-bg:        hsl(220, 22%, 9%);     /* Deep navy — slightly warmer than current 222,25%,10% */
--iv-surface-raised:   hsl(220, 20%, 13%);    /* Sidebar, detail panel background */
--iv-surface-panel:    hsl(220, 18%, 16%);    /* Host node background */
--iv-surface-elevated: hsl(220, 16%, 20%);    /* Hover states, active buttons */
--iv-surface-inset:    hsl(220, 15%, 12%);    /* Search input, inset fields */

/* Borders */
--iv-border-faint:     hsla(220, 18%, 32%, 0.45);   /* Zone outlines, separators */
--iv-border-subtle:    hsla(220, 18%, 38%, 0.6);    /* Panel edges, card borders */
--iv-border-strong:    hsla(220, 18%, 48%, 0.8);    /* Focused states, active panels */

/* Typography */
--iv-text-primary:     hsl(220, 10%, 91%);     /* Main readable text — warm white, not pure */
--iv-text-secondary:   hsl(220, 12%, 64%);     /* IP addresses, descriptions, secondary labels */
--iv-text-muted:       hsl(220, 12%, 46%);     /* Section labels, metadata, timestamps */
--iv-text-ghost:       hsl(220, 12%, 34%);     /* Placeholder text, deeply muted */

/* Interactive Chrome */
--iv-accent-blue:      hsl(215, 52%, 58%);     /* Primary interactive — links, focus rings */
--iv-accent-blue-dim:  hsla(215, 52%, 58%, 0.15); /* Button backgrounds, highlights */

/* Status Semantics (unchanged — these work) */
--iv-status-ok:        hsl(145, 55%, 48%);     /* synced, healthy */
--iv-status-warn:      hsl(38, 78%, 54%);      /* out-of-sync, degraded */
--iv-status-error:     hsl(2, 62%, 52%);       /* failed, critical */
--iv-status-inactive:  hsl(220, 12%, 40%);     /* not deployed, inactive */
```

### Per-Host Accent Colors (keep all five, tune saturation slightly)

These are the *only* strong colors in the interface. Everything else is near-monochrome. This makes each host feel individually owned.

```css
/* Host accent colors — applied as borderLeft on HostNode and label color in sidebar */
--iv-host-red:    hsl(2, 62%, 56%);      /* was: hsl(0, 65%, 55%) — slightly warmer */
--iv-host-amber:  hsl(35, 75%, 54%);     /* was: hsl(35, 80%, 55%) — slightly muted */
--iv-host-teal:   hsl(162, 46%, 48%);    /* was: hsl(160, 50%, 50%) — unchanged */
--iv-host-blue:   hsl(215, 52%, 58%);    /* was: hsl(220, 50%, 60%) — consistent with chrome accent */
--iv-host-purple: hsl(268, 42%, 58%);    /* was: hsl(270, 45%, 60%) — slightly muted */
```

### What Changed and Why
- Canvas background: `222,25%,10%` → `220,22%,9%` — less saturated, slightly darker for contrast
- Sidebar: `222,25%,8%` → `220,20%,13%` — less dramatic separation from canvas (they're the same space)
- Surface colors: pulled from 14%/18% to 13%/16% — tighter, more refined
- Host accents: all desaturated by ~3-5 points — less "game UI", more "technical tool"

---

## 4. Typography

### Fonts (keep existing pair — it's correct for the aesthetic)
- **Inter** — UI chrome, labels, descriptions, body text
- **JetBrains Mono** — machine values: IP addresses, image names, chart names, ports, timestamps, section labels

The key improvement is *how these fonts are deployed*, not replacing them.

### Type Scale

| Role | Font | Size | Weight | Color | Usage |
|------|------|------|--------|-------|-------|
| host-label | JetBrains Mono | 13px | 600 | host accent | Hostname in HostNode header |
| host-ip | JetBrains Mono | 11px | 400 | `--iv-text-muted` | IP address next to hostname |
| service-name | Inter | 13px | 400 | `--iv-text-primary` | Service row label |
| service-name-k8s | JetBrains Mono | 12px | 400 | `--iv-text-primary` | K8s service names (mono = deliberate) |
| section-label | JetBrains Mono | 10px | 500 | `--iv-text-ghost` | SEARCH, LAYERS, TAGS, HOSTS sidebar headers |
| panel-title | Inter | 20px | 700 | `--iv-text-primary` | Service/host name in detail panel |
| panel-subtitle | Inter | 13px | 400 | `--iv-text-secondary` | Description, IP·Zone line |
| kv-label | JetBrains Mono | 10px | 500 | `--iv-text-muted` | KEY labels in detail panel |
| kv-value | Inter / JetBrains Mono | 13px | 400 | `--iv-text-primary` | Values (mono only for machine strings) |
| badge | JetBrains Mono | 10px | 400 | accent or muted | Dependency badges, status pills |
| nav-title | Inter | 13px | 400 | `--iv-text-muted` | "InfraVision — Homelab Infrastructure Map" |
| timestamp | JetBrains Mono | 10px | 400 | `--iv-text-ghost` | Updated timestamp in sidebar footer |

### Letter Spacing Rules
- ALL-CAPS labels: `letter-spacing: 0.07em` (slightly tighter than current 0.08em)
- Monospace values at small sizes: `letter-spacing: 0.02em` (prevents crowding)
- No letter spacing on body text or service names

### Typography Anti-patterns to Fix
- **Current:** `fontSize: 22` for panel title — reduce to `20px`, weight stays at 700
- **Current:** Section labels use Inter — switch all to JetBrains Mono at 10px (makes them feel like field labels in a schematic)
- **Current:** IP address uses Inter — switch to JetBrains Mono (it's a machine value)

---

## 5. Spacing & Layout Rhythm

### Base Unit: 4px grid
Everything snaps to multiples of 4.

### Sidebar Spacing
```
Sidebar width:        220px  (was 240px — tighter, feels like a panel not a column)
Sidebar padding:      16px 12px (was 16px 14px)
Section gap:          20px  between sections (unchanged — correct)
Section label bottom: 6px   (was 8px — tighter to its content)
Item gap in lists:    5px   (was 6px — slight tightening)
Search bottom:        18px  (was 20px)
```

### Host Node Spacing
```
Header padding:       10px 14px (unchanged — correct)
Header height:        36px minimum
Service row height:   32px minimum, auto for wrapped content
Service row padding:  5px 10px (was 6px 10px)
Gap between services: 0  (rows touch — continuous list, not separated cards)
HostNode border-left: 2px (was 3px — more refined, less chunky)
```

### Detail Panel Spacing
```
Panel width:          300px (was 320px — slightly narrower, less intrusive)
Padding:              20px  (was 24px 20px — square)
KV row gap:           10px  (unchanged)
Section gap:          18px  (was 20px — slightly tighter)
Title margin-top:     6px   (was 8px)
```

### Canvas Header
```
Height:               36px (was 40px — proportionally tighter)
Padding-left:         16px (unchanged)
```

### Zone Node
```
Border-radius:        8px (was 12px — sharper, more schematic)
Label padding:        10px 14px (was 12px 16px)
```

---

## 6. Host Panel (HostNode) Design

### Current State
- 1px border + 3px left border in accent color
- `borderRadius: 8`
- Flat background `hsla(222, 20%, 14%, 0.95)`
- Header with hostname + IP + physConn badge

### Specification

**Shape & Border:**
```
background:    hsl(220, 18%, 15%)          /* slightly lighter than canvas */
border:        1px solid hsla(220, 18%, 32%, 0.5)
border-left:   2px solid [host-accent]     /* accent color, not 3px */
border-radius: 6px                         /* was 8px — sharper */
```

**Header (hostname bar):**
```
padding:         10px 14px
border-bottom:   1px solid hsla(220, 15%, 26%, 0.5)
background:      transparent                /* no header background — panel BG is enough */
min-height:      36px
```

**Hostname:**
```
font:       JetBrains Mono 13px 600
color:      [host-accent]                  /* unchanged — strong, correct */
```

**IP Address:**
```
font:       JetBrains Mono 11px 400
color:      hsl(220, 12%, 46%)             /* --iv-text-muted */
margin-left: 6px
```

**Physical Connection Badge:**
```
background:    hsla(215, 45%, 52%, 0.12)
border:        1px solid hsla(215, 45%, 52%, 0.25)
color:         hsl(215, 45%, 62%)
border-radius: 4px                          /* was 8px — rectangular, not pill */
font:          JetBrains Mono 10px
padding:       2px 7px
```
Change from pill to rectangle — pills look like tags; this is a technical badge.

**Service List Area:**
```
padding:     4px 0                         /* top/bottom breathing room */
             0 service rows flush to left edge (no left padding) — rows start at 10px
```

**Inactive/Dimmed State:**
```
opacity: 0.18 (was 0.2 — fractionally dimmer to increase contrast with active)
transition: opacity 0.18s ease
```

---

## 7. Service Row (ServiceNode) Design

### Current Issues
- Highlighted background `hsla(220, 25%, 28%, 0.6)` is slightly too blue-heavy
- Outline on highlight is barely visible

### Specification

**Default state:**
```
background:  transparent
padding:     5px 10px
min-height:  32px
font:        Inter 13px, color hsl(220, 10%, 91%)
```

**Hovered (self):**
```
background:  hsla(220, 16%, 22%, 0.7)
```

**Highlighted (is-in-dependency-chain):**
```
background:  hsla(215, 24%, 26%, 0.65)
outline:     1px solid hsla(215, 48%, 54%, 0.35)
```

**Dimmed:**
```
opacity: 0.18
```

**Not-deployed badge:**
```
font:        JetBrains Mono 9px
padding:     1px 6px
border-radius: 3px                          /* square corner, not pill */
background:  hsla(220, 18%, 22%, 0.7)
color:       hsl(220, 12%, 46%)
border:      1px solid hsla(220, 18%, 32%, 0.5)
letter-spacing: 0.04em
```

**Dependency badge:**
```
border-radius: 4px                          /* rectangular — same treatment as connection badge */
font:    JetBrains Mono 10px
padding: 1px 7px
```
Keep colored background/border using the dep color — this is correct and distinctive.

**K8s sync dot:**
```
width: 7px, height: 7px (was 8px — slightly smaller)
border-radius: 50%
margin-right: 2px
```

---

## 8. Zone Node Design

### Current State
- `hsla(220, 15%, 18%, 0.4)` background, 1px border, 12px radius, small label

### Specification

Zones are *containers*, not nodes. They should recede visually.

```
background:    hsla(220, 16%, 17%, 0.35)   /* slightly more transparent */
border:        1px solid hsla(220, 16%, 34%, 0.4)
border-radius: 8px                          /* was 12px — sharper */
```

**Zone label:**
```
font:            JetBrains Mono 10px 500
color:           hsl(220, 12%, 46%)         /* --iv-text-muted */
letter-spacing:  0.07em
text-transform:  uppercase
position:        absolute, top 10px, left 14px
```
Switch to uppercase JetBrains Mono — zone names are location identifiers, not prose.

---

## 9. Sidebar Design

### Current Issues
- At 240px it eats too much canvas real estate
- Layer buttons (full-width colored fills) look like SaaS nav items
- Section labels in Inter feel generic

### Specification

**Container:**
```
width:         220px                        /* was 240px */
background:    hsl(220, 20%, 11%)           /* slightly lighter than canvas — distinct but not jarring */
border-right:  1px solid hsla(220, 16%, 26%, 0.6)
padding:       14px 12px
```

**Section Labels:**
```
font:            JetBrains Mono 10px 500
color:           hsl(220, 12%, 40%)         /* --iv-text-ghost */
letter-spacing:  0.07em
text-transform:  uppercase
margin-bottom:   6px
```

**Search Input:**
```
background:    hsla(220, 16%, 14%, 0.8)
border:        1px solid hsla(220, 16%, 28%, 0.5)
border-radius: 4px                          /* was 6px — sharper */
color:         hsl(220, 10%, 91%)
font:          Inter 13px
padding:       7px 10px 7px 30px            /* tighter than current 8px */
```
On focus: `border-color: hsla(215, 52%, 58%, 0.6)` — single focus treatment, no glow.

**Layer Toggles — Change the Design:**

Current: Full-width colored fill buttons. This reads as "SaaS product" and the colors fight with host accent colors.

New treatment: Row of three minimal toggle chips. Active = white text on dark surface with a thin accent underline. Inactive = muted text, no background.

```
/* Each layer button */
height:        28px                         /* was 34px */
padding:       0 10px
border-radius: 4px
font:          Inter 12px 500
border:        none

/* Active */
background:    hsla(220, 16%, 24%, 0.9)
color:         hsl(220, 10%, 91%)
box-shadow:    inset 0 -1px 0 [layer-color]  /* bottom line in layer's semantic color */

/* Layer semantic colors for the inset line only */
physical:      hsl(215, 52%, 58%)            /* blue */
services:      hsl(35, 75%, 54%)             /* amber */
k8s:           hsl(162, 46%, 48%)            /* teal */

/* Inactive */
background:    transparent
color:         hsl(220, 12%, 46%)
```

This keeps layer color coding but removes the loud colored fills.

**Show Inactive Toggle:**
```
height:        26px                         /* was 34px */
border-radius: 4px
font:          JetBrains Mono 11px
padding:       0 10px

Active:
  background:  hsla(220, 16%, 22%, 0.7)
  border:      1px solid hsla(220, 16%, 34%, 0.5)
  color:       hsl(220, 12%, 64%)

Inactive:
  background:  transparent
  border:      1px solid transparent
  color:       hsl(220, 12%, 40%)
```

**Tag Pills:**
```
padding:       3px 8px                      /* was 4px 10px */
border-radius: 3px                          /* was 12px — rectangular, not pill */
font:          Inter 11px
border:        1px solid hsla(220, 16%, 28%, 0.5)

Active:
  background:  hsla(215, 52%, 58%, 0.18)
  border:      1px solid hsla(215, 52%, 58%, 0.4)
  color:       hsl(215, 52%, 72%)

Inactive:
  background:  hsla(220, 16%, 18%, 0.5)
  color:       hsl(220, 12%, 52%)
```
Tags become rectangular pills — consistent with the schematic/technical aesthetic. Pills look like CRM tags; rectangles look like chip selectors on a control panel.

**Host List Items:**
```
font:          Inter 13px
padding:       3px 0                        /* was no explicit padding */

Color dot:
  width: 7px, height: 7px
  border-radius: 2px                        /* small square, not circle */
  background: host-accent

Active text:   hsl(220, 10%, 88%)
Inactive text: hsl(220, 12%, 44%)
Inactive dot:  opacity 0.35
```
Change host dots from circles to small squares — hosts are machines, squares signal "hardware."

**Sidebar Footer (timestamp):**
```
margin-top:    auto
padding-top:   12px
border-top:    1px solid hsla(220, 16%, 22%, 0.5)
font:          JetBrains Mono 10px
color:         hsl(220, 12%, 36%)
```

---

## 10. Detail Panel Design

### Current Issues
- Width 320px is slightly wide; bottom gets cut off on shorter viewports
- `h2` at `fontSize: 22` is too large relative to the panel width
- Background same as canvas — blends into it visually

### Specification

**Container:**
```
width:         300px                        /* was 320px */
background:    hsl(220, 20%, 11%)           /* same as sidebar — they're chrome, not canvas */
border-left:   1px solid hsla(220, 16%, 26%, 0.6)
padding:       18px 18px                    /* was 24px 20px */
animation:     slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)  /* expo-out easing */
```

**Header row (type label + close):**
```
margin-bottom:  3px                         /* tight */
```

**Type label (SERVICE DETAIL / HOST DETAIL):**
```
font:            JetBrains Mono 10px 500
color:           hsl(220, 12%, 44%)
letter-spacing:  0.07em
```

**Close button:**
```
color:           hsl(220, 12%, 50%)
hover color:     hsl(220, 10%, 75%)
```

**Panel title (service/host name):**
```
font:    Inter 18px 700                     /* was 22px — more proportionate */
color:   hsl(220, 10%, 91%)   [service]
color:   [host-accent]        [host]
margin:  6px 0 3px
```

**Description / subtitle:**
```
font:    Inter 13px 400
color:   hsl(220, 12%, 60%)
margin:  0 0 14px
```

**Horizontal divider:**
```
height:     1px
background: hsla(220, 16%, 26%, 0.5)
margin:     14px 0                          /* was 16px */
```

**KV rows:**
```
Key:   JetBrains Mono 10px 500, color hsl(220, 12%, 46%), letter-spacing 0.07em
Value: Inter 13px, color hsl(220, 10%, 91%)
Value (mono): JetBrains Mono 12px, color hsl(220, 10%, 85%)
Row gap:  9px (was 10px)
```

**Section title:**
```
font:            JetBrains Mono 10px 500
color:           hsl(220, 12%, 44%)
letter-spacing:  0.07em
text-transform:  uppercase
margin-bottom:   6px
```

**Dependency links ("→ service-name"):**
```
font:    Inter 13px
color:   hsl(215, 52%, 66%)
margin:  3px 0
```

**Quick links:**
```
font:    Inter 13px
color:   hsl(215, 52%, 66%)
hover:   hsl(215, 52%, 80%)
gap:     6px  between icon and label
row gap: 6px  (was 8px)
```

**Tag chips in detail panel:**
```
Same as sidebar tags (rectangular, 3px radius)
```

---

## 11. Canvas Chrome

### Top Header Bar
```
height:      36px                           /* was 40px */
background:  hsla(220, 20%, 9%, 0.92)
border-bottom: 1px solid hsla(220, 16%, 22%, 0.5)
backdrop-filter: blur(6px)
font:        Inter 12px 400                /* was 13px */
color:       hsl(220, 12%, 44%)
```

The title "InfraVision — Homelab Infrastructure Map" should read as a quiet label, not a header. If it feels too present, make it even more muted — it's just a caption.

### Canvas Background Pattern
```
Dot grid:
  gap:   20px (unchanged)
  size:  1px
  color: hsla(220, 14%, 28%, 0.25)         /* slightly lighter than current 0.3 */
```

### React Flow Controls
```
border:           1px solid hsla(220, 16%, 26%, 0.5)
border-radius:    6px                       /* was 8px */
button background: hsl(220, 18%, 13%)
button hover:      hsl(220, 16%, 18%)
button fill:       hsl(220, 12%, 50%)
```

### MiniMap
```
background:  hsl(220, 20%, 11%)
border:      1px solid hsla(220, 16%, 26%, 0.5)
border-radius: 6px
mask:        hsla(220, 22%, 7%, 0.75)
```

---

## 12. Edges (Connection Lines)

Current: edges are rendered empty (`edges={[]}`). If/when edges are added:

```
Default:
  stroke:       hsla(220, 18%, 42%, 0.5)
  stroke-width: 1px
  stroke-dasharray: none (solid)

Active/highlighted:
  stroke:       hsla(215, 52%, 62%, 0.85)
  stroke-width: 1.5px

Dimmed:
  opacity: 0.12

Physical connections:
  stroke:       hsla(35, 75%, 54%, 0.5)   /* amber — same as services layer color */
  stroke-dasharray: 4 3

K8s internal:
  stroke:       hsla(162, 46%, 48%, 0.4)  /* teal */
  stroke-dasharray: none
```

---

## 13. Motion

### Principles
- All transitions: `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for entrances
- Exit/collapse: `cubic-bezier(0.4, 0, 1, 1)` (ease-in) — fast exits
- Duration: 150–200ms for micro-interactions, 220ms for panel slide-in
- No bounce, no elastic, no spring

### Specific Transitions

**Detail panel slide-in:**
```css
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0.6; }
  to   { transform: translateX(0);    opacity: 1;   }
}
animation: slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
```

**Node opacity changes (dim/undim):**
```
transition: opacity 0.18s ease
```

**Layer toggle / button states:**
```
transition: background 0.12s ease, color 0.12s ease
```

**Search focus ring:**
```
transition: border-color 0.1s ease
```

---

## 14. Interaction States

### Focus
All interactive elements: `outline: 2px solid hsla(215, 52%, 58%, 0.5); outline-offset: 2px`  
No custom focus rings — use outline.

### Hover
- Sidebar items: background transitions to `--iv-surface-elevated`
- Canvas nodes: no hover effect on HostNode itself (it's a container); ServiceNode gets subtle background
- Buttons: background lightens, no color change

### Scrollbars (sidebar + detail panel)
```css
/* In index.css */
.iv-scrollable::-webkit-scrollbar { width: 4px; }
.iv-scrollable::-webkit-scrollbar-track { background: transparent; }
.iv-scrollable::-webkit-scrollbar-thumb { 
  background: hsla(220, 16%, 32%, 0.5);
  border-radius: 2px;
}
```

---

## 15. Loading & Empty States

**Loading screen:**
```
background: hsl(220, 22%, 9%)
text:        JetBrains Mono 12px, color hsl(220, 12%, 44%)
content:     "loading infrastructure data..." (lowercase, no spinner)
position:    centered
```
No spinner. The text alone — monospaced, lowercase, muted — is the aesthetic.

**Error screen:**
```
text:  Inter 13px, color hsl(2, 62%, 52%)
max-width: 440px, centered, padding 0 24px
```

---

## 16. K8s Cluster Node

Read `K8sClusterNode.tsx` to verify, but apply same patterns as HostNode:
- `border-left: 2px solid [teal]` instead of 3px
- `border-radius: 6px`
- Header in JetBrains Mono
- Same surface color `hsl(220, 18%, 15%)`

---

## 17. Concrete Changes Summary

A prioritized list of changes to implement, in order of visual impact:

### P0 — Highest Impact
1. **Sidebar width** → 220px
2. **Layer toggle buttons** → replace colored fills with minimal toggles + inset bottom line in semantic color
3. **Tag pills** → rectangular (3px radius), not pill-shaped (12px radius)
4. **Host sidebar dots** → small squares (2px radius), not circles
5. **Section labels** → all switch to JetBrains Mono 10px, including sidebar sections and detail panel sections
6. **HostNode border-left** → 2px, not 3px
7. **PhysConn badge** → 4px radius (rectangular), not 8px (pill)

### P1 — Medium Impact
8. **Detail panel width** → 300px
9. **Detail panel title** → 18px, not 22px
10. **Canvas header** → 36px height, 12px font
11. **Zone border-radius** → 8px, not 12px
12. **All border-radius values** → pull toward sharper (6px where 8px was, 4px where 6px was, 3px where "small" was)
13. **IP addresses** → switch to JetBrains Mono everywhere
14. **slideIn animation** → use expo-out easing instead of linear ease

### P2 — Refinements
15. **Canvas dot grid** → `0.25` opacity instead of `0.3`
16. **Scrollbar styling** → add thin 4px custom scrollbars to sidebar and detail panel
17. **Sidebar footer padding** → `margin-top: auto` (push to bottom) with `padding-top: 12px`
18. **Show inactive toggle** → reduce height to 26px, tighten padding
19. **Host accent desaturation** → apply the tuned accent values from section 3

---

## 18. CSS Token Update (index.css)

```css
:root {
  /* Replace current tokens with these */
  --iv-canvas-bg:        220 22% 9%;
  --iv-surface-raised:   220 20% 11%;
  --iv-surface-panel:    220 18% 15%;
  --iv-surface-elevated: 220 16% 20%;
  --iv-surface-inset:    220 16% 13%;

  --iv-border-faint:     220 18% 32%;    /* use with /0.45 opacity */
  --iv-border-subtle:    220 18% 38%;    /* use with /0.6 opacity */
  --iv-border-strong:    220 18% 48%;    /* use with /0.8 opacity */

  --iv-text-primary:     220 10% 91%;
  --iv-text-secondary:   220 12% 64%;
  --iv-text-muted:       220 12% 46%;
  --iv-text-ghost:       220 12% 36%;

  --iv-accent:           215 52% 58%;
  --iv-accent-dim:       215 52% 58%;    /* use with /0.15 opacity */

  --iv-status-ok:        145 55% 48%;
  --iv-status-warn:      38 78% 54%;
  --iv-status-error:     2 62% 52%;

  --iv-host-red:         2 62% 56%;
  --iv-host-amber:       35 75% 54%;
  --iv-host-teal:        162 46% 48%;
  --iv-host-blue:        215 52% 58%;
  --iv-host-purple:      268 42% 58%;

  --iv-sidebar-width:    220px;
  --iv-panel-width:      300px;
}
```

---

## 19. What Not to Build

These patterns were rejected based on reference analysis. Do not introduce them:

- Glassmorphism (blur + translucent cards as a decorative pattern)
- Gradient backgrounds on sidebar or canvas
- Glowing box shadows on nodes or panels
- Icon tiles as node representations (the current text-list approach is correct)
- Colorful filled buttons in the sidebar chrome (replaced with minimal toggles)
- Pill-shaped tags (replaced with rectangular chips)
- Rounded (12px+) radii on anything that represents a technical/machine concept
- Animation on layout properties (width, height, padding) — transform/opacity only
- A hero metric layout anywhere in the UI
- Pure black or pure white in any color value

---

## 20. Guiding Question for Every UI Decision

*"Does this look like something a careful engineer made specifically for their homelab, or does it look like a dashboard UI kit?"*

If the answer is the latter, simplify, sharpen corners, reduce color, and lean on JetBrains Mono for machine values. The aesthetic earns its "mine" quality through restraint and precision, not through personality flourishes.
