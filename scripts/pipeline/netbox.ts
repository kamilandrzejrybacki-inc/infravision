import type { PhysicalDevice, PhysicalInterface, NetworkPrefix, PhysicalConnection } from "./types.js";

interface NetBoxConfig {
  url: string;
  token: string;
}

async function netboxGet<T>(config: NetBoxConfig, endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`/api/${endpoint}/`, config.url);
  url.searchParams.set("limit", "100");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${config.token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`NetBox ${endpoint}: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

interface NetBoxList<T> {
  count: number;
  results: T[];
}

interface NetBoxDevice {
  id: number;
  name: string;
  status: { value: string; label: string };
  site: { name: string } | null;
  role: { name: string } | null;
  primary_ip4: { address: string } | null;
  tags: Array<{ name: string }>;
}

interface NetBoxInterface {
  id: number;
  name: string;
  device: { id: number; name: string };
  type: { value: string; label: string };
  enabled: boolean;
  cable: { id: number } | null;
}

interface NetBoxCable {
  id: number;
  a_terminations: Array<{ object: { id: number; device: { id: number; name: string }; name: string } }>;
  b_terminations: Array<{ object: { id: number; device: { id: number; name: string }; name: string } }>;
  label: string;
  status: { value: string };
}

interface NetBoxPrefix {
  id: number;
  prefix: string;
  description: string;
  status: { value: string };
}

interface NetBoxIPAddress {
  id: number;
  address: string;
  dns_name: string;
  description: string;
  status: { value: string };
  assigned_object: { device: { id: number; name: string } } | null;
}

/** Step 1a: Query NetBox for physical infrastructure */
export async function discoverPhysicalLayer(config: NetBoxConfig): Promise<{
  devices: PhysicalDevice[];
  prefixes: NetworkPrefix[];
  connections: PhysicalConnection[];
}> {
  console.log("[netbox] Querying devices...");
  const devicesResp = await netboxGet<NetBoxList<NetBoxDevice>>(config, "dcim/devices");

  console.log("[netbox] Querying interfaces...");
  const interfacesResp = await netboxGet<NetBoxList<NetBoxInterface>>(config, "dcim/interfaces");

  console.log("[netbox] Querying cables...");
  const cablesResp = await netboxGet<NetBoxList<NetBoxCable>>(config, "dcim/cables");

  console.log("[netbox] Querying prefixes...");
  const prefixesResp = await netboxGet<NetBoxList<NetBoxPrefix>>(config, "ipam/prefixes");

  console.log("[netbox] Querying IP addresses...");
  const ipsResp = await netboxGet<NetBoxList<NetBoxIPAddress>>(config, "ipam/ip-addresses");

  // Build IP lookup: device ID → IP address
  const deviceIpMap = new Map<number, string>();
  for (const ip of ipsResp.results) {
    if (ip.assigned_object?.device) {
      deviceIpMap.set(ip.assigned_object.device.id, ip.address.split("/")[0]);
    }
  }

  // Also check if device name IS an IP address (NetBox devices named by IP)
  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

  // Build interface lookup: device ID → interfaces
  const deviceInterfaces = new Map<number, PhysicalInterface[]>();
  for (const iface of interfacesResp.results) {
    const devId = iface.device.id;
    if (!deviceInterfaces.has(devId)) {
      deviceInterfaces.set(devId, []);
    }
    deviceInterfaces.get(devId)!.push({
      id: iface.id,
      name: iface.name,
      type: iface.type.value,
      enabled: iface.enabled,
      cableId: iface.cable?.id ?? null,
    });
  }

  // Transform devices
  const devices: PhysicalDevice[] = devicesResp.results.map(d => ({
    id: d.id,
    name: d.name,
    ip: deviceIpMap.get(d.id) ?? (ipRegex.test(d.name) ? d.name : ""),
    status: d.status.value as PhysicalDevice["status"],
    site: d.site?.name ?? "",
    role: d.role?.name ?? "",
    interfaces: deviceInterfaces.get(d.id) ?? [],
    tags: d.tags.map(t => t.name),
  }));

  // Transform prefixes
  const prefixes: NetworkPrefix[] = prefixesResp.results.map(p => ({
    id: p.id,
    prefix: p.prefix,
    description: p.description,
    status: p.status.value,
  }));

  // Transform cables → physical connections
  const connections: PhysicalConnection[] = cablesResp.results
    .filter(c => c.a_terminations.length > 0 && c.b_terminations.length > 0)
    .map(c => ({
      sourceDevice: c.a_terminations[0].object.device.name,
      targetDevice: c.b_terminations[0].object.device.name,
      sourceInterface: c.a_terminations[0].object.name,
      targetInterface: c.b_terminations[0].object.name,
      label: c.label || `${c.a_terminations[0].object.name}↔${c.b_terminations[0].object.name}`,
    }));

  console.log(`[netbox] Found ${devices.length} devices, ${prefixes.length} prefixes, ${connections.length} cables`);
  return { devices, prefixes, connections };
}
