/**
 * Repository pattern for infrastructure data access.
 *
 * Abstracts lookups over the loaded InfraVisionData so callers are
 * decoupled from the underlying data source (static JSON, live API, etc.).
 */
import type { Connection, Host, InfraVisionData, Service } from './types';

// --- Repository interface ---

export interface InfrastructureRepository {
  getServiceById(id: string): Service | undefined;
  getHostById(id: string): Host | undefined;
  getAllServices(): Service[];
  getAllHosts(): Host[];
  getConnections(): Connection[];
  getHostsWithServices(): Host[];
}

// --- In-memory implementation backed by InfraVisionData ---

export class InfraVisionRepository implements InfrastructureRepository {
  private readonly serviceIndex: ReadonlyMap<string, Service>;
  private readonly hostIndex: ReadonlyMap<string, Host>;

  constructor(private readonly data: InfraVisionData) {
    this.serviceIndex = new Map(data.services.map(s => [s.id, s]));
    this.hostIndex = new Map(data.hosts.map(h => [h.id, h]));
  }

  getServiceById(id: string): Service | undefined {
    return this.serviceIndex.get(id);
  }

  getHostById(id: string): Host | undefined {
    return this.hostIndex.get(id);
  }

  getAllServices(): Service[] {
    return this.data.services;
  }

  getAllHosts(): Host[] {
    return this.data.hosts;
  }

  getConnections(): Connection[] {
    return this.data.connections;
  }

  /** Returns hosts with their services pre-joined (matching the loaded JSON). */
  getHostsWithServices(): Host[] {
    return this.data.hosts.map(h => ({
      ...h,
      services: this.data.services.filter(s => s.hostId === h.id),
    }));
  }
}
