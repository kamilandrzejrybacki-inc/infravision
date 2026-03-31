import { z } from "zod";

// --- Zod schemas for runtime validation at data boundaries ---

export const QuickLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  icon: z.string(),
});

export const ServiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  hostId: z.string(),
  type: z.enum(["docker", "k8s", "native"]),
  ports: z.array(z.number()),
  image: z.string().optional(),
  chart: z.string().optional(),
  namespace: z.string().optional(),
  syncStatus: z.enum(["synced", "out-of-sync", "failed"]).optional(),
  dependencies: z.array(z.string()),
  tags: z.array(z.string()),
  quickLinks: z.array(QuickLinkSchema),
  ansiblePlaybook: z.string().optional(),
  argocdApp: z.string().optional(),
  active: z.boolean().optional(),
});

export const HostSchema = z.object({
  id: z.string(),
  label: z.string(),
  ip: z.string(),
  fullIp: z.string().optional(),
  zone: z.string(),
  color: z.string(),
  services: z.array(ServiceSchema).default([]),
  tags: z.array(z.string()),
  netboxUrl: z.string().optional(),
  grafanaDashboard: z.string().optional(),
});

export const NetworkZoneSchema = z.object({
  id: z.string(),
  cidr: z.string(),
  label: z.string(),
  hostIds: z.array(z.string()),
});

export const ConnectionSchema = z.object({
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  type: z.enum(["dependency", "physical"]),
});

export const InfraVisionDataSchema = z.object({
  metadata: z.object({
    generated_at: z.string(),
    sources: z.object({
      netbox: z.string(),
      ansible: z.string(),
      argocd: z.string().optional(),
      grafana: z.string().optional(),
      prometheus: z.string().optional(),
    }),
  }),
  zones: z.array(NetworkZoneSchema),
  hosts: z.array(HostSchema),
  services: z.array(ServiceSchema),
  connections: z.array(ConnectionSchema),
  tags: z.array(z.string()),
});

// --- TypeScript types inferred from schemas ---

export type QuickLink = z.infer<typeof QuickLinkSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Host = z.infer<typeof HostSchema>;
export type NetworkZone = z.infer<typeof NetworkZoneSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type InfraVisionData = z.infer<typeof InfraVisionDataSchema>;
