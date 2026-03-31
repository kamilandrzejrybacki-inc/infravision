import { Search } from "lucide-react";
import type { Host } from "@/data/types";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeLayers: string[];
  onToggleLayer: (layer: string) => void;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  activeHosts: string[];
  onToggleHost: (hostId: string) => void;
  showInactive: boolean;
  onToggleInactive: () => void;
  generatedAt?: string;
  tags?: string[];
  hosts?: Host[];
}

const layers = [
  { id: "physical", label: "Physical", color: "hsl(215, 52%, 58%)" },
  { id: "services", label: "Services", color: "hsl(35, 75%, 54%)" },
  { id: "k8s", label: "K8s", color: "hsl(162, 46%, 48%)" },
];

export default function Sidebar({
  searchQuery, onSearchChange,
  activeLayers, onToggleLayer,
  activeTags, onToggleTag,
  activeHosts, onToggleHost,
  showInactive, onToggleInactive,
  generatedAt,
  tags = [],
  hosts = [],
}: SidebarProps) {
  return (
    <div
      className="iv-scrollable"
      style={{
        width: 220,
        height: "100vh",
        background: "hsl(220, 20%, 11%)",
        borderRight: "1px solid hsla(220, 16%, 26%, 0.6)",
        padding: "14px 12px",
        overflowY: "auto",
        flexShrink: 0,
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Search */}
      <SectionLabel>SEARCH</SectionLabel>
      <div style={{ position: "relative", marginBottom: 18 }}>
        <Search
          size={13}
          style={{ position: "absolute", left: 9, top: 9, color: "hsl(220, 12%, 36%)" }}
        />
        <input
          type="text"
          placeholder="Search services, hosts..."
          maxLength={200}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            padding: "7px 10px 7px 30px",
            background: "hsla(220, 16%, 14%, 0.8)",
            border: "1px solid hsla(220, 16%, 28%, 0.5)",
            borderRadius: 4,
            color: "hsl(220, 10%, 91%)",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.1s ease",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "hsla(215, 52%, 58%, 0.6)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "hsla(220, 16%, 28%, 0.5)"; }}
        />
      </div>

      {/* Layers */}
      <SectionLabel>LAYERS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
        {layers.map(layer => {
          const active = activeLayers.includes(layer.id);
          return (
            <button
              key={layer.id}
              onClick={() => onToggleLayer(layer.id)}
              style={{
                height: 28,
                borderRadius: 4,
                border: "none",
                background: active ? "hsla(220, 16%, 24%, 0.9)" : "transparent",
                color: active ? "hsl(220, 10%, 91%)" : "hsl(220, 12%, 46%)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.12s ease, color 0.12s ease",
                fontFamily: "inherit",
                boxShadow: active ? `inset 0 -1px 0 ${layer.color}` : "none",
                padding: "0 10px",
                textAlign: "left",
              }}
            >
              {layer.label}
            </button>
          );
        })}
      </div>

      {/* Show inactive toggle */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={onToggleInactive}
          style={{
            width: "100%",
            height: 26,
            borderRadius: 4,
            border: showInactive ? "1px solid hsla(220, 16%, 34%, 0.5)" : "1px solid transparent",
            background: showInactive ? "hsla(220, 16%, 22%, 0.7)" : "transparent",
            color: showInactive ? "hsl(220, 12%, 64%)" : "hsl(220, 12%, 40%)",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
            transition: "background 0.12s ease, color 0.12s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            padding: "0 10px",
          }}
        >
          <span style={{ fontSize: 9 }}>{showInactive ? "◉" : "○"}</span>
          show not deployed
        </button>
      </div>

      {/* Tags */}
      <SectionLabel>TAGS</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 20 }}>
        {tags.map(tag => {
          const active = activeTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                fontSize: 11,
                border: active
                  ? "1px solid hsla(215, 52%, 58%, 0.4)"
                  : "1px solid hsla(220, 16%, 28%, 0.5)",
                background: active
                  ? "hsla(215, 52%, 58%, 0.18)"
                  : "hsla(220, 16%, 18%, 0.5)",
                color: active ? "hsl(215, 52%, 72%)" : "hsl(220, 12%, 52%)",
                cursor: "pointer",
                transition: "background 0.12s ease, color 0.12s ease",
                fontFamily: "inherit",
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Hosts */}
      <SectionLabel>HOSTS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {hosts.map(host => {
          const active = activeHosts.includes(host.id);
          return (
            <label
              key={host.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: active ? "hsl(220, 10%, 88%)" : "hsl(220, 12%, 44%)",
                cursor: "pointer",
                padding: "3px 0",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: `hsl(${host.color})`,
                  opacity: active ? 1 : 0.35,
                  flexShrink: 0,
                }}
              />
              <span>{host.label}</span>
            </label>
          );
        })}
      </div>

      {generatedAt && (
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid hsla(220, 16%, 22%, 0.5)" }}>
          <span style={{
            fontSize: 10,
            color: "hsl(220, 12%, 36%)",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.02em",
          }}>
            {new Date(generatedAt).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 500,
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "hsl(220, 12%, 40%)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
