import { X } from "lucide-react";
import type { Service, Host } from "@/data/types";
import { getHostById, getServiceById } from "@/data/infrastructure";

interface DetailPanelProps {
  selectedId: string | null;
  selectedType: "service" | "host" | null;
  onClose: () => void;
}

export default function DetailPanel({ selectedId, selectedType, onClose }: DetailPanelProps) {
  if (!selectedId || !selectedType) return null;

  const isService = selectedType === "service";
  const service = isService ? getServiceById(selectedId) : null;
  const host = isService ? (service ? getHostById(service.hostId) : null) : getHostById(selectedId);

  if (!service && !host) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: 320,
        background: "hsl(222, 25%, 10%)",
        borderLeft: "1px solid hsla(220, 20%, 25%, 0.6)",
        padding: "24px 20px",
        overflowY: "auto",
        zIndex: 50,
        fontFamily: "'Inter', sans-serif",
        animation: "slideIn 0.25s ease",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsla(220, 15%, 55%, 0.8)" }}>
          {isService ? "SERVICE DETAIL" : "HOST DETAIL"}
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "hsla(220, 15%, 55%, 0.8)", cursor: "pointer", padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {isService && service ? (
        <ServiceDetail service={service} host={host} />
      ) : host ? (
        <HostDetail host={host} />
      ) : null}
    </div>
  );
}

function ServiceDetail({ service, host }: { service: Service; host: Host | undefined }) {
  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "hsla(0, 0%, 92%, 0.95)", margin: "8px 0 4px" }}>
        {service.label}
      </h2>
      <p style={{ fontSize: 13, color: "hsla(220, 15%, 65%, 0.8)", margin: "0 0 16px" }}>
        {service.description}
      </p>

      <div style={{ height: 1, background: "hsla(220, 15%, 25%, 0.5)", margin: "16px 0" }} />

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
            service.syncStatus === "synced" ? "hsl(145, 60%, 50%)"
              : service.syncStatus === "out-of-sync" ? "hsl(40, 80%, 55%)"
              : "hsl(0, 65%, 55%)"
          }
        />
      )}

      {service.dependencies.length > 0 && (
        <Section title="DEPENDS ON">
          {service.dependencies.map(dep => (
            <div key={dep} style={{ fontSize: 13, color: "hsla(210, 50%, 65%, 0.9)", marginBottom: 4 }}>
              → {getServiceById(dep)?.label || dep}
            </div>
          ))}
        </Section>
      )}

      {service.tags.length > 0 && (
        <Section title="TAGS">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {service.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        </Section>
      )}

      {service.quickLinks.length > 0 && (
        <Section title="QUICK LINKS">
          {service.quickLinks.map(link => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, color: "hsla(210, 60%, 65%, 0.95)",
                textDecoration: "none", marginBottom: 8,
              }}
            >
              <span>{link.icon}</span> {link.label}
            </a>
          ))}
        </Section>
      )}
    </>
  );
}

function HostDetail({ host }: { host: Host }) {
  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: `hsl(${host.color})`, margin: "8px 0 4px" }}>
        {host.label}
      </h2>
      <p style={{ fontSize: 13, color: "hsla(220, 15%, 65%, 0.8)", margin: "0 0 16px" }}>
        IP: {host.ip} · Zone: {host.zone}
      </p>

      <div style={{ height: 1, background: "hsla(220, 15%, 25%, 0.5)", margin: "16px 0" }} />

      <Section title="SERVICES">
        {host.services.map(s => (
          <div key={s.id} style={{ fontSize: 13, color: "hsla(0, 0%, 90%, 0.9)", marginBottom: 6 }}>
            • {s.label}
            <span style={{ fontSize: 11, color: "hsla(220, 15%, 55%, 0.7)", marginLeft: 8 }}>
              {s.type}
            </span>
          </div>
        ))}
      </Section>

      {host.tags.length > 0 && (
        <Section title="TAGS">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {host.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        </Section>
      )}
    </>
  );
}

function KeyValue({ label, value, mono, valueColor }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsla(220, 15%, 55%, 0.8)", flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: valueColor || "hsla(0, 0%, 92%, 0.95)",
          fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
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
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsla(220, 15%, 55%, 0.8)", marginBottom: 8 }}>
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
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        background: "hsla(220, 15%, 22%, 0.6)",
        color: "hsla(220, 10%, 75%, 0.9)",
        border: "1px solid hsla(220, 15%, 30%, 0.4)",
      }}
    >
      {tag}
    </span>
  );
}
