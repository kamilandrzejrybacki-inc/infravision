import { X } from "lucide-react";
import type { Service, Host } from "@/data/types";

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

interface DetailPanelProps {
  selectedId: string | null;
  selectedType: "service" | "host" | null;
  onClose: () => void;
  getServiceById: (id: string) => Service | undefined;
  getHostById: (id: string) => Host | undefined;
}

export default function DetailPanel({ selectedId, selectedType, onClose, getServiceById, getHostById }: DetailPanelProps) {
  if (!selectedId || !selectedType) return null;

  const isService = selectedType === "service";
  const service = isService ? getServiceById(selectedId) : null;
  const host = isService ? (service ? getHostById(service.hostId) : null) : getHostById(selectedId);

  if (!service && !host) return null;

  return (
    <div
      className="iv-scrollable"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: 300,
        background: "hsl(220, 20%, 11%)",
        borderLeft: "1px solid hsla(220, 16%, 26%, 0.6)",
        padding: "18px 18px",
        overflowY: "auto",
        zIndex: 50,
        fontFamily: "'Inter', sans-serif",
        animation: "slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "hsl(220, 12%, 44%)",
        }}>
          {isService ? "SERVICE DETAIL" : "HOST DETAIL"}
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "hsl(220, 12%, 50%)", cursor: "pointer", padding: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "hsl(220, 10%, 75%)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "hsl(220, 12%, 50%)"; }}
        >
          <X size={16} />
        </button>
      </div>

      {isService && service ? (
        <ServiceDetail service={service} host={host} getServiceById={getServiceById} />
      ) : host ? (
        <HostDetail host={host} />
      ) : null}
    </div>
  );
}

function ServiceDetail({ service, host, getServiceById }: { service: Service; host: Host | undefined; getServiceById: (id: string) => Service | undefined }) {
  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "hsl(220, 10%, 91%)", margin: "6px 0 3px" }}>
        {service.label}
      </h2>
      <p style={{ fontSize: 13, color: "hsl(220, 12%, 60%)", margin: "0 0 14px" }}>
        {service.description}
      </p>

      <div style={{ height: 1, background: "hsla(220, 16%, 26%, 0.5)", margin: "14px 0" }} />

      <KeyValue label="HOST" value={host?.label || "—"} />
      <KeyValue label="TYPE" value={service.type.charAt(0).toUpperCase() + service.type.slice(1)} />
      {service.ports.length > 0 && <KeyValue label="PORTS" value={service.ports.join(", ")} />}
      {service.image && <KeyValue label="IMAGE" value={service.image} mono />}
      {service.chart && <KeyValue label="CHART" value={service.chart} mono />}
      {service.syncStatus && (
        <KeyValue
          label="SYNC"
          value={service.syncStatus}
          valueColor={
            service.syncStatus === "synced" ? "hsl(145, 55%, 48%)"
              : service.syncStatus === "out-of-sync" ? "hsl(38, 78%, 54%)"
              : "hsl(2, 62%, 52%)"
          }
        />
      )}

      {service.dependencies.length > 0 && (
        <Section title="DEPENDS ON">
          {service.dependencies.map(dep => (
            <div key={dep} style={{ fontSize: 13, color: "hsl(215, 52%, 66%)", marginBottom: 3 }}>
              → {getServiceById(dep)?.label || dep}
            </div>
          ))}
        </Section>
      )}

      {service.tags.length > 0 && (
        <Section title="TAGS">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {service.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        </Section>
      )}

      {service.quickLinks.length > 0 && (
        <Section title="QUICK LINKS">
          {service.quickLinks.map(link => (
            isSafeUrl(link.url) ? (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, color: "hsl(215, 52%, 66%)",
                  textDecoration: "none", marginBottom: 6,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "hsl(215, 52%, 80%)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "hsl(215, 52%, 66%)"; }}
              >
                <span>{link.icon}</span> {link.label}
              </a>
            ) : null
          ))}
        </Section>
      )}
    </>
  );
}

function HostDetail({ host }: { host: Host }) {
  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: `hsl(${host.color})`, margin: "6px 0 3px" }}>
        {host.label}
      </h2>
      <p style={{ fontSize: 13, color: "hsl(220, 12%, 60%)", margin: "0 0 14px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{host.ip}</span>
        {" · "}Zone: {host.zone}
      </p>

      <div style={{ height: 1, background: "hsla(220, 16%, 26%, 0.5)", margin: "14px 0" }} />

      <Section title="SERVICES">
        {host.services.map(s => (
          <div key={s.id} style={{ fontSize: 13, color: "hsl(220, 10%, 91%)", marginBottom: 6 }}>
            • {s.label}
            <span style={{ fontSize: 11, color: "hsl(220, 12%, 46%)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              {s.type}
            </span>
          </div>
        ))}
      </Section>

      {host.tags.length > 0 && (
        <Section title="TAGS">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {host.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        </Section>
      )}
    </>
  );
}

function KeyValue({ label, value, mono, valueColor }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, gap: 12 }}>
      <span style={{
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "hsl(220, 12%, 46%)",
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span
        style={{
          fontSize: mono ? 12 : 13,
          color: valueColor || (mono ? "hsl(220, 10%, 85%)" : "hsl(220, 10%, 91%)"),
          fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
          letterSpacing: mono ? "0.02em" : undefined,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "hsl(220, 12%, 44%)",
        marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 3,
        fontSize: 11,
        background: "hsla(220, 16%, 18%, 0.5)",
        color: "hsl(220, 12%, 52%)",
        border: "1px solid hsla(220, 16%, 28%, 0.5)",
      }}
    >
      {tag}
    </span>
  );
}
