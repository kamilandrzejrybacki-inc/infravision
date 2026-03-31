import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

interface ZoneData {
  label: string;
  width: number;
  height: number;
}

const ZoneNode = memo(({ data }: NodeProps) => {
  const { label, width, height } = data as unknown as ZoneData;
  return (
    <div
      style={{
        width,
        height,
        background: "hsla(220, 16%, 17%, 0.35)",
        border: "1px solid hsla(220, 16%, 34%, 0.4)",
        borderRadius: 8,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 10,
          left: 14,
          fontSize: 10,
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', monospace",
          color: "hsl(220, 12%, 46%)",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
});

ZoneNode.displayName = "ZoneNode";
export default ZoneNode;
