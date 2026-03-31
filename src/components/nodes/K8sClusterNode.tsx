import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

const K8sClusterNode = memo(({ data }: NodeProps) => {
  const width = (data as any).width as number;
  return (
    <div
      style={{
        width,
        height: 24,
        borderLeft: "2px solid hsla(200, 60%, 50%, 0.6)",
        paddingLeft: 10,
        display: "flex",
        alignItems: "center",
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        fontWeight: 500,
        color: "hsla(200, 50%, 65%, 0.8)",
        letterSpacing: "0.03em",
      }}
    >
      K3s cluster
    </div>
  );
});

K8sClusterNode.displayName = "K8sClusterNode";
export default K8sClusterNode;
