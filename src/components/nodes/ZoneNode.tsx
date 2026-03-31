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
        background: "hsla(220, 15%, 18%, 0.4)",
        border: "1px solid hsla(220, 20%, 35%, 0.5)",
        borderRadius: 12,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 12,
          left: 16,
          fontSize: 11,
          fontWeight: 500,
          color: "hsla(220, 20%, 65%, 0.8)",
          letterSpacing: "0.05em",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {label}
      </span>
    </div>
  );
});

ZoneNode.displayName = "ZoneNode";
export default ZoneNode;
