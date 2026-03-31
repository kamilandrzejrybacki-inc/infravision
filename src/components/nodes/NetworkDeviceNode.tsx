import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

interface NetworkDeviceData {
  label: string;
  ip: string;
  role: "router" | "switch";
  width: number;
  height: number;
}

const roleIcons: Record<string, string> = {
  router: "⬡",
  switch: "⬢",
};

const NetworkDeviceNode = memo(({ data }: NodeProps) => {
  const { label, ip, role, width, height } = data as unknown as NetworkDeviceData;

  return (
    <div
      style={{
        width,
        height,
        background: "hsla(220, 16%, 14%, 0.8)",
        border: "1px solid hsla(220, 18%, 32%, 0.4)",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        color: "hsl(220, 12%, 50%)",
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ fontSize: 12, opacity: 0.6 }}>{roleIcons[role] ?? "◇"}</span>
      <span>{label}</span>
      {ip && (
        <span style={{ color: "hsl(220, 12%, 38%)", fontSize: 9 }}>{ip}</span>
      )}
    </div>
  );
});

NetworkDeviceNode.displayName = "NetworkDeviceNode";
export default NetworkDeviceNode;
