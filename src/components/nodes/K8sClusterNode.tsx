import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

const K8sClusterNode = memo(({ data }: NodeProps) => {
  const width = (data as any).width as number;
  return (
    <div
      style={{
        width,
        height: 24,
        borderLeft: "2px solid hsla(162, 46%, 48%, 0.6)",
        paddingLeft: 10,
        display: "flex",
        alignItems: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        color: "hsl(162, 46%, 52%)",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
      }}
    >
      K3s cluster
    </div>
  );
});

K8sClusterNode.displayName = "K8sClusterNode";
export default K8sClusterNode;
