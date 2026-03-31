# InfraVision Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Prefect flow that queries NetBox, Ansible, ArgoCD, and Prometheus to generate `infravision-data.json`, orchestrated by an n8n workflow that commits the output to GitHub.

**Architecture:** Four parallel Prefect tasks gather raw data from each source, a normalize task merges them into the unified schema, and an emit task serializes JSON. The n8n workflow triggers the flow, receives the JSON, and commits it to the infravision GitHub repo. GitHub Pages auto-deploys on push.

**Tech Stack:** Python 3.12, Prefect 3.x, FastAPI, httpx, asyncpg, PyYAML, n8n

**Spec:** `docs/superpowers/specs/2026-03-31-infravision-design.md`

**Existing Patterns:** Follow the `synthesis` flow in `/home/kamil-rybacki/Code/prefect-etl/` — same project structure, registry pattern, task decorators, client conventions, Settings via pydantic-settings with env prefix.

---

## File Map

All paths relative to `/home/kamil-rybacki/Code/prefect-etl/`.

| File | Action | Responsibility |
|------|--------|----------------|
| `src/etl/flows/registry.py` | Modify | Add `"infravision-generate"` to `FLOW_ALLOWLIST` |
| `src/etl/flows/__init__.py` | Modify | Import new flow module |
| `src/etl/flows/infravision/__init__.py` | Create | Package init |
| `src/etl/flows/infravision/models.py` | Create | Pydantic models for infravision data |
| `src/etl/flows/infravision/flow.py` | Create | Main flow orchestration |
| `src/etl/flows/infravision/netbox.py` | Create | `query_netbox` task |
| `src/etl/flows/infravision/ansible.py` | Create | `parse_ansible` task |
| `src/etl/flows/infravision/argocd.py` | Create | `query_argocd` task |
| `src/etl/flows/infravision/prometheus.py` | Create | `query_prometheus` task |
| `src/etl/flows/infravision/normalize.py` | Create | `normalize` task — merge all sources |
| `src/etl/config.py` | Modify | Add infravision-specific settings |
| `tests/test_infravision_models.py` | Create | Model validation tests |
| `tests/test_infravision_normalize.py` | Create | Normalize logic tests |
| `tests/test_infravision_netbox.py` | Create | NetBox task tests (mocked HTTP) |
| `tests/test_infravision_argocd.py` | Create | ArgoCD task tests (mocked HTTP) |
| `tests/test_infravision_prometheus.py` | Create | Prometheus task tests (mocked HTTP) |
| `tests/test_infravision_ansible.py` | Create | Ansible parser tests |

---

### Task 1: Define Pydantic models

**Files:**
- Create: `src/etl/flows/infravision/models.py`
- Create: `src/etl/flows/infravision/__init__.py`
- Create: `tests/test_infravision_models.py`

- [ ] **Step 1: Write model validation tests**

```python
# tests/test_infravision_models.py
import pytest
from etl.flows.infravision.models import (
    QuickLink, ServiceRecord, HostRecord, NetworkZoneRecord,
    ConnectionRecord, InfraVisionOutput, RawNetBoxHost,
    RawAnsibleService, RawArgoApp, RawPrometheusContainer,
)


def test_service_record_docker():
    svc = ServiceRecord(
        id="svc-n8n",
        label="n8n",
        description="Workflow automation",
        host_id="lw-n1",
        type="docker",
        ports=[5678],
        image="docker.n8n.io/n8nio/n8n:latest",
        dependencies=["svc-postgres"],
        tags=["automation"],
        quick_links=[QuickLink(label="Web UI", url="https://n8n.lab.local", icon="🌐")],
    )
    assert svc.type == "docker"
    assert svc.chart is None
    assert svc.sync_status is None


def test_service_record_k8s():
    svc = ServiceRecord(
        id="svc-argocd",
        label="ArgoCD",
        description="GitOps controller",
        host_id="lw-c1",
        type="k8s",
        ports=[443],
        namespace="argocd",
        chart="argo-cd",
        sync_status="synced",
        dependencies=[],
        tags=["dev-tools"],
        quick_links=[],
    )
    assert svc.type == "k8s"
    assert svc.namespace == "argocd"


def test_connection_record():
    conn = ConnectionRecord(
        source="svc-n8n",
        target="svc-postgres",
        label="data store",
        type="dependency",
    )
    assert conn.type == "dependency"


def test_infravision_output_serialization():
    output = InfraVisionOutput(
        metadata={"generated_at": "2026-03-31T10:00:00Z", "sources": {}},
        zones=[],
        hosts=[],
        services=[],
        connections=[],
        tags=[],
    )
    data = output.model_dump(by_alias=True)
    assert "metadata" in data
    assert isinstance(data["tags"], list)


def test_raw_netbox_host():
    host = RawNetBoxHost(
        id="lw-c1",
        label="lw-c1",
        ip="192.168.0.107",
        zone="primary",
        netbox_url="https://netbox.lab.local/dcim/devices/1/",
    )
    assert host.ip == "192.168.0.107"


def test_raw_ansible_service():
    svc = RawAnsibleService(
        id="svc-n8n",
        label="n8n",
        description="Workflow automation platform",
        host_id="lw-n1",
        type="docker",
        ports=[5678],
        image="docker.n8n.io/n8nio/n8n",
        tags=["automation"],
        playbook_path="automation/n8n-setup",
        dependencies=["svc-postgres", "svc-redis"],
    )
    assert svc.playbook_path == "automation/n8n-setup"


def test_raw_argo_app():
    app = RawArgoApp(
        name="prefect-etl",
        namespace="prefect-etl",
        chart="prefect-etl",
        sync_status="synced",
        health_status="Healthy",
        host_id="lw-c1",
    )
    assert app.sync_status == "synced"


def test_raw_prometheus_container():
    container = RawPrometheusContainer(
        name="n8n",
        image="docker.n8n.io/n8nio/n8n:1.70.3",
        host="lw-n1",
        ports=[5678],
    )
    assert container.image == "docker.n8n.io/n8nio/n8n:1.70.3"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'etl.flows.infravision'`

- [ ] **Step 3: Create the package init**

```python
# src/etl/flows/infravision/__init__.py
```

Empty file.

- [ ] **Step 4: Create the models**

```python
# src/etl/flows/infravision/models.py
from __future__ import annotations

from pydantic import BaseModel, Field


# --- Output schema (matches frontend InfraVisionData) ---

class QuickLink(BaseModel):
    label: str
    url: str
    icon: str


class ServiceRecord(BaseModel):
    id: str
    label: str
    description: str
    host_id: str = Field(alias="hostId", serialization_alias="hostId")
    type: str  # "docker" | "k8s" | "native"
    ports: list[int] = Field(default_factory=list)
    image: str | None = None
    chart: str | None = None
    namespace: str | None = None
    sync_status: str | None = Field(
        default=None, alias="syncStatus", serialization_alias="syncStatus"
    )
    dependencies: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    quick_links: list[QuickLink] = Field(
        default_factory=list, alias="quickLinks", serialization_alias="quickLinks"
    )
    ansible_playbook: str | None = Field(
        default=None, alias="ansiblePlaybook", serialization_alias="ansiblePlaybook"
    )
    argocd_app: str | None = Field(
        default=None, alias="argocdApp", serialization_alias="argocdApp"
    )

    model_config = {"populate_by_name": True}


class HostRecord(BaseModel):
    id: str
    label: str
    ip: str  # Short form, e.g. ".107"
    full_ip: str = Field(alias="fullIp", serialization_alias="fullIp")
    zone: str
    color: str
    tags: list[str] = Field(default_factory=list)
    netbox_url: str | None = Field(
        default=None, alias="netboxUrl", serialization_alias="netboxUrl"
    )
    grafana_dashboard: str | None = Field(
        default=None, alias="grafanaDashboard", serialization_alias="grafanaDashboard"
    )

    model_config = {"populate_by_name": True}


class NetworkZoneRecord(BaseModel):
    id: str
    cidr: str
    label: str
    host_ids: list[str] = Field(alias="hostIds", serialization_alias="hostIds")

    model_config = {"populate_by_name": True}


class ConnectionRecord(BaseModel):
    source: str
    target: str
    label: str | None = None
    type: str  # "dependency" | "physical"


class InfraVisionOutput(BaseModel):
    metadata: dict
    zones: list[NetworkZoneRecord]
    hosts: list[HostRecord]
    services: list[ServiceRecord]
    connections: list[ConnectionRecord]
    tags: list[str]


# --- Raw data from each source (intermediate) ---

class RawNetBoxHost(BaseModel):
    id: str
    label: str
    ip: str
    zone: str
    netbox_url: str | None = None


class RawAnsibleService(BaseModel):
    id: str
    label: str
    description: str
    host_id: str
    type: str
    ports: list[int] = Field(default_factory=list)
    image: str | None = None
    tags: list[str] = Field(default_factory=list)
    playbook_path: str | None = None
    dependencies: list[str] = Field(default_factory=list)


class RawArgoApp(BaseModel):
    name: str
    namespace: str
    chart: str | None = None
    sync_status: str
    health_status: str
    host_id: str  # Always lw-c1 for K3s


class RawPrometheusContainer(BaseModel):
    name: str
    image: str
    host: str
    ports: list[int] = Field(default_factory=list)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_models.py -v`
Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/__init__.py src/etl/flows/infravision/models.py tests/test_infravision_models.py
git commit -m "feat: add infravision data models"
```

---

### Task 2: Add infravision settings to config

**Files:**
- Modify: `src/etl/config.py`

- [ ] **Step 1: Add infravision settings**

Add the following fields to the existing `Settings` class in `src/etl/config.py`:

```python
# Infravision data sources
netbox_url: str = "http://netbox.lab.local:8080"
netbox_api_token: SecretStr = SecretStr("")
argocd_url: str = "http://argocd.lab.local"
argocd_api_token: SecretStr = SecretStr("")
prometheus_url: str = "http://prometheus.lab.local:9090"
ansible_repo_path: str = "/tmp/ansible"
ansible_repo_url: str = ""
grafana_url: str = "http://grafana.lab.local:3000"
caddy_domain: str = "lab.local"
```

These will be populated via environment variables with the `SYNTH_` prefix (e.g., `SYNTH_NETBOX_URL`, `SYNTH_NETBOX_API_TOKEN`).

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/ -v --timeout=30`
Expected: All existing tests pass (new fields have defaults so they don't break anything).

- [ ] **Step 3: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/config.py
git commit -m "feat: add infravision settings to config"
```

---

### Task 3: Implement `query_netbox` task

**Files:**
- Create: `src/etl/flows/infravision/netbox.py`
- Create: `tests/test_infravision_netbox.py`

- [ ] **Step 1: Write tests with mocked HTTP**

```python
# tests/test_infravision_netbox.py
import pytest
import httpx
import respx
from etl.flows.infravision.netbox import query_netbox
from etl.flows.infravision.models import RawNetBoxHost


NETBOX_URL = "http://netbox.test:8080"

DEVICES_RESPONSE = {
    "results": [
        {
            "id": 1,
            "name": "lw-c1",
            "device_role": {"slug": "compute"},
            "status": {"value": "active"},
            "url": f"{NETBOX_URL}/dcim/devices/1/",
        },
        {
            "id": 2,
            "name": "lw-n1",
            "device_role": {"slug": "services"},
            "status": {"value": "active"},
            "url": f"{NETBOX_URL}/dcim/devices/2/",
        },
    ],
    "next": None,
}

IP_ADDRESSES_RESPONSE_LW_C1 = {
    "results": [
        {
            "address": "192.168.0.107/24",
            "assigned_object": {"device": {"id": 1}},
        }
    ],
    "next": None,
}

IP_ADDRESSES_RESPONSE_LW_N1 = {
    "results": [
        {
            "address": "192.168.0.105/24",
            "assigned_object": {"device": {"id": 2}},
        }
    ],
    "next": None,
}

PREFIXES_RESPONSE = {
    "results": [
        {"prefix": "192.168.0.0/24", "description": "Primary Network"},
        {"prefix": "10.0.1.0/24", "description": "NAS Subnet"},
    ],
    "next": None,
}


@pytest.mark.asyncio
@respx.mock
async def test_query_netbox_returns_hosts():
    respx.get(f"{NETBOX_URL}/api/dcim/devices/", params={"status": "active", "limit": 100}).mock(
        return_value=httpx.Response(200, json=DEVICES_RESPONSE)
    )
    respx.get(f"{NETBOX_URL}/api/ipam/ip-addresses/", params={"device_id": 1, "limit": 100}).mock(
        return_value=httpx.Response(200, json=IP_ADDRESSES_RESPONSE_LW_C1)
    )
    respx.get(f"{NETBOX_URL}/api/ipam/ip-addresses/", params={"device_id": 2, "limit": 100}).mock(
        return_value=httpx.Response(200, json=IP_ADDRESSES_RESPONSE_LW_N1)
    )
    respx.get(f"{NETBOX_URL}/api/ipam/prefixes/", params={"limit": 100}).mock(
        return_value=httpx.Response(200, json=PREFIXES_RESPONSE)
    )

    hosts, zones = await query_netbox.fn(
        netbox_url=NETBOX_URL,
        api_token="test-token",
    )

    assert len(hosts) == 2
    assert isinstance(hosts[0], RawNetBoxHost)
    assert hosts[0].id == "lw-c1"
    assert hosts[0].ip == "192.168.0.107"
    assert hosts[0].zone == "primary"
    assert len(zones) == 2


@pytest.mark.asyncio
@respx.mock
async def test_query_netbox_assigns_zone_by_prefix():
    respx.get(f"{NETBOX_URL}/api/dcim/devices/", params={"status": "active", "limit": 100}).mock(
        return_value=httpx.Response(200, json=DEVICES_RESPONSE)
    )
    respx.get(f"{NETBOX_URL}/api/ipam/ip-addresses/", params={"device_id": 1, "limit": 100}).mock(
        return_value=httpx.Response(200, json=IP_ADDRESSES_RESPONSE_LW_C1)
    )
    respx.get(f"{NETBOX_URL}/api/ipam/ip-addresses/", params={"device_id": 2, "limit": 100}).mock(
        return_value=httpx.Response(200, json=IP_ADDRESSES_RESPONSE_LW_N1)
    )
    respx.get(f"{NETBOX_URL}/api/ipam/prefixes/", params={"limit": 100}).mock(
        return_value=httpx.Response(200, json=PREFIXES_RESPONSE)
    )

    hosts, _ = await query_netbox.fn(
        netbox_url=NETBOX_URL,
        api_token="test-token",
    )

    for host in hosts:
        assert host.zone in ("primary", "nas")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_netbox.py -v`
Expected: FAIL — `ImportError: cannot import name 'query_netbox'`

- [ ] **Step 3: Implement the task**

```python
# src/etl/flows/infravision/netbox.py
from __future__ import annotations

import ipaddress

import httpx
import structlog
from prefect import task
from prefect.cache_policies import NONE

from .models import RawNetBoxHost

logger = structlog.get_logger()


def _ip_in_prefix(ip: str, prefix: str) -> bool:
    return ipaddress.ip_address(ip) in ipaddress.ip_network(prefix, strict=False)


def _zone_id_from_description(description: str) -> str:
    lower = description.lower()
    if "nas" in lower:
        return "nas"
    if "lab" in lower:
        return "lab"
    return "primary"


@task(
    name="query_netbox",
    retries=3,
    retry_delay_seconds=10,
    timeout_seconds=120,
    cache_policy=NONE,
)
async def query_netbox(
    netbox_url: str,
    api_token: str,
) -> tuple[list[RawNetBoxHost], list[dict]]:
    """Query NetBox for active devices, their IPs, and network prefixes."""
    headers = {
        "Authorization": f"Token {api_token}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        # Fetch prefixes first — needed for zone assignment
        prefixes_resp = await client.get(
            f"{netbox_url}/api/ipam/prefixes/",
            params={"limit": 100},
        )
        prefixes_resp.raise_for_status()
        prefixes_data = prefixes_resp.json()["results"]

        zones = []
        for p in prefixes_data:
            zone_id = _zone_id_from_description(p.get("description", ""))
            zones.append({
                "id": zone_id,
                "cidr": p["prefix"],
                "label": p.get("description", p["prefix"]).upper(),
            })

        # Fetch active devices
        devices_resp = await client.get(
            f"{netbox_url}/api/dcim/devices/",
            params={"status": "active", "limit": 100},
        )
        devices_resp.raise_for_status()
        devices = devices_resp.json()["results"]

        hosts: list[RawNetBoxHost] = []
        for device in devices:
            device_id = device["id"]
            device_name = device["name"]

            # Fetch IPs for this device
            ip_resp = await client.get(
                f"{netbox_url}/api/ipam/ip-addresses/",
                params={"device_id": device_id, "limit": 100},
            )
            ip_resp.raise_for_status()
            ip_results = ip_resp.json()["results"]

            if not ip_results:
                logger.warning("device_no_ip", device=device_name)
                continue

            # Use first IP, strip CIDR suffix
            raw_ip = ip_results[0]["address"].split("/")[0]

            # Determine zone from prefix match
            zone = "primary"
            for p in prefixes_data:
                if _ip_in_prefix(raw_ip, p["prefix"]):
                    zone = _zone_id_from_description(p.get("description", ""))
                    break

            hosts.append(RawNetBoxHost(
                id=device_name,
                label=device_name,
                ip=raw_ip,
                zone=zone,
                netbox_url=device.get("url"),
            ))

        logger.info("netbox_query_complete", host_count=len(hosts), zone_count=len(zones))
        return hosts, zones
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_netbox.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/netbox.py tests/test_infravision_netbox.py
git commit -m "feat: add query_netbox task for infravision"
```

---

### Task 4: Implement `parse_ansible` task

**Files:**
- Create: `src/etl/flows/infravision/ansible.py`
- Create: `tests/test_infravision_ansible.py`

- [ ] **Step 1: Write tests**

```python
# tests/test_infravision_ansible.py
import pytest
import tempfile
import os
from pathlib import Path
from etl.flows.infravision.ansible import parse_ansible
from etl.flows.infravision.models import RawAnsibleService


@pytest.fixture
def mock_ansible_repo(tmp_path: Path) -> Path:
    """Create a minimal Ansible repo structure for testing."""
    # automation/n8n-setup playbook
    playbook_dir = tmp_path / "automation" / "n8n-setup"
    playbook_dir.mkdir(parents=True)

    (playbook_dir / "inventory").mkdir()
    (playbook_dir / "inventory" / "hosts.yml").write_text(
        "all:\n  hosts:\n    lw-n1:\n      ansible_host: 192.168.0.105\n"
    )

    (playbook_dir / "roles").mkdir()
    (playbook_dir / "roles" / "n8n").mkdir(parents=True)
    templates_dir = playbook_dir / "roles" / "n8n" / "templates"
    templates_dir.mkdir()
    (templates_dir / "docker-compose.yml.j2").write_text(
        "services:\n"
        "  n8n:\n"
        "    image: docker.n8n.io/n8nio/n8n:{{ n8n_version | default('latest') }}\n"
        "    ports:\n"
        "      - '{{ n8n_port | default(5678) }}:5678'\n"
    )

    defaults_dir = playbook_dir / "roles" / "n8n" / "defaults"
    defaults_dir.mkdir()
    (defaults_dir / "main.yml").write_text(
        "n8n_port: 5678\n"
        "n8n_version: '1.70.3'\n"
    )

    # monitoring/grafana-stack-setup playbook
    grafana_dir = tmp_path / "monitoring" / "grafana-stack-setup"
    grafana_dir.mkdir(parents=True)

    (grafana_dir / "inventory").mkdir()
    (grafana_dir / "inventory" / "hosts.yml").write_text(
        "all:\n  hosts:\n    lw-n1:\n      ansible_host: 192.168.0.105\n"
    )

    (grafana_dir / "roles").mkdir()
    (grafana_dir / "roles" / "grafana").mkdir(parents=True)
    g_templates = grafana_dir / "roles" / "grafana" / "templates"
    g_templates.mkdir()
    (g_templates / "docker-compose.yml.j2").write_text(
        "services:\n"
        "  grafana:\n"
        "    image: grafana/grafana:{{ grafana_version | default('11.0.0') }}\n"
        "    ports:\n"
        "      - '3000:3000'\n"
        "  prometheus:\n"
        "    image: prom/prometheus:{{ prometheus_version | default('v2.53.0') }}\n"
        "    ports:\n"
        "      - '9090:9090'\n"
    )

    return tmp_path


@pytest.mark.asyncio
async def test_parse_ansible_finds_services(mock_ansible_repo: Path):
    services = await parse_ansible.fn(repo_path=str(mock_ansible_repo))

    assert len(services) >= 2
    labels = {s.label for s in services}
    assert "n8n" in labels
    assert "grafana" in labels


@pytest.mark.asyncio
async def test_parse_ansible_extracts_ports(mock_ansible_repo: Path):
    services = await parse_ansible.fn(repo_path=str(mock_ansible_repo))
    n8n = next(s for s in services if s.label == "n8n")
    assert 5678 in n8n.ports


@pytest.mark.asyncio
async def test_parse_ansible_assigns_tags_from_category(mock_ansible_repo: Path):
    services = await parse_ansible.fn(repo_path=str(mock_ansible_repo))
    n8n = next(s for s in services if s.label == "n8n")
    assert "automation" in n8n.tags

    grafana = next(s for s in services if s.label == "grafana")
    assert "monitoring" in grafana.tags


@pytest.mark.asyncio
async def test_parse_ansible_assigns_host(mock_ansible_repo: Path):
    services = await parse_ansible.fn(repo_path=str(mock_ansible_repo))
    n8n = next(s for s in services if s.label == "n8n")
    assert n8n.host_id == "lw-n1"


@pytest.mark.asyncio
async def test_parse_ansible_sets_playbook_path(mock_ansible_repo: Path):
    services = await parse_ansible.fn(repo_path=str(mock_ansible_repo))
    n8n = next(s for s in services if s.label == "n8n")
    assert n8n.playbook_path == "automation/n8n-setup"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_ansible.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement the task**

```python
# src/etl/flows/infravision/ansible.py
from __future__ import annotations

import re
from pathlib import Path

import structlog
import yaml
from prefect import task
from prefect.cache_policies import NONE

from .models import RawAnsibleService

logger = structlog.get_logger()

CATEGORY_DIRS = {
    "automation", "monitoring", "files", "security",
    "infrastructure", "ai", "dev-tools", "desktop",
}


def _extract_ports_from_compose(compose_text: str) -> dict[str, list[int]]:
    """Extract service names and host ports from a docker-compose Jinja2 template."""
    services: dict[str, list[int]] = {}
    try:
        # Strip Jinja2 conditionals to make it parseable as YAML
        cleaned = re.sub(r"\{%.*?%\}", "", compose_text)
        # Replace Jinja2 vars with placeholder values for parsing
        cleaned = re.sub(r"\{\{.*?\}\}", "placeholder", cleaned)
        data = yaml.safe_load(cleaned)
        if not data or "services" not in data:
            return services

        for svc_name, svc_config in data.get("services", {}).items():
            ports: list[int] = []
            for port_mapping in svc_config.get("ports", []):
                port_str = str(port_mapping).split(":")[0].strip("'\" ")
                try:
                    ports.append(int(port_str))
                except ValueError:
                    pass
            services[svc_name] = ports
    except yaml.YAMLError:
        logger.warning("compose_parse_error", exc_info=True)
    return services


def _extract_image_from_compose(compose_text: str, service_name: str) -> str | None:
    """Extract the base image name for a service from compose template."""
    # Match: image: some/image:{{ var | default('tag') }}
    # or:   image: some/image:tag
    pattern = rf"{service_name}:\s*\n\s*image:\s*(.+)"
    match = re.search(pattern, compose_text)
    if match:
        image_line = match.group(1).strip()
        # Strip Jinja2 version vars, keep base image
        image_base = re.sub(r"\{\{.*?\}\}", "latest", image_line)
        return image_base
    return None


def _parse_hosts_yml(hosts_path: Path) -> str | None:
    """Extract the first host name from an Ansible inventory hosts.yml."""
    try:
        data = yaml.safe_load(hosts_path.read_text())
        if not data:
            return None
        hosts_section = data.get("all", {}).get("hosts", {})
        if hosts_section:
            return next(iter(hosts_section.keys()))
    except (yaml.YAMLError, StopIteration):
        pass
    return None


@task(
    name="parse_ansible",
    retries=1,
    timeout_seconds=120,
    cache_policy=NONE,
)
async def parse_ansible(repo_path: str) -> list[RawAnsibleService]:
    """Parse Ansible playbook repo to extract Docker service definitions."""
    root = Path(repo_path)
    services: list[RawAnsibleService] = []

    for category_dir in sorted(root.iterdir()):
        if not category_dir.is_dir():
            continue
        category = category_dir.name
        if category not in CATEGORY_DIRS:
            continue

        for playbook_dir in sorted(category_dir.iterdir()):
            if not playbook_dir.is_dir():
                continue

            # Find inventory host
            hosts_file = playbook_dir / "inventory" / "hosts.yml"
            host_id = _parse_hosts_yml(hosts_file) if hosts_file.exists() else None
            if not host_id:
                continue

            # Find docker-compose templates
            compose_files = list(playbook_dir.rglob("docker-compose*.j2"))
            if not compose_files:
                continue

            playbook_path = f"{category}/{playbook_dir.name}"

            for compose_file in compose_files:
                compose_text = compose_file.read_text()
                svc_ports = _extract_ports_from_compose(compose_text)

                for svc_name, ports in svc_ports.items():
                    image = _extract_image_from_compose(compose_text, svc_name)
                    services.append(RawAnsibleService(
                        id=f"svc-{svc_name}",
                        label=svc_name,
                        description=f"{svc_name} service",
                        host_id=host_id,
                        type="docker",
                        ports=ports,
                        image=image,
                        tags=[category],
                        playbook_path=playbook_path,
                        dependencies=[],
                    ))

    logger.info("ansible_parse_complete", service_count=len(services))
    return services
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_ansible.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/ansible.py tests/test_infravision_ansible.py
git commit -m "feat: add parse_ansible task for infravision"
```

---

### Task 5: Implement `query_argocd` task

**Files:**
- Create: `src/etl/flows/infravision/argocd.py`
- Create: `tests/test_infravision_argocd.py`

- [ ] **Step 1: Write tests with mocked HTTP**

```python
# tests/test_infravision_argocd.py
import pytest
import httpx
import respx
from etl.flows.infravision.argocd import query_argocd
from etl.flows.infravision.models import RawArgoApp


ARGOCD_URL = "http://argocd.test"

APPS_RESPONSE = {
    "items": [
        {
            "metadata": {"name": "prefect-etl"},
            "spec": {
                "destination": {"namespace": "prefect-etl"},
                "source": {"chart": "prefect-etl", "repoURL": "https://charts.example.com"},
            },
            "status": {
                "sync": {"status": "Synced"},
                "health": {"status": "Healthy"},
            },
        },
        {
            "metadata": {"name": "n8n-workers"},
            "spec": {
                "destination": {"namespace": "n8n"},
                "source": {"chart": "n8n-workers", "repoURL": "https://charts.example.com"},
            },
            "status": {
                "sync": {"status": "OutOfSync"},
                "health": {"status": "Healthy"},
            },
        },
    ]
}


@pytest.mark.asyncio
@respx.mock
async def test_query_argocd_returns_apps():
    respx.get(f"{ARGOCD_URL}/api/v1/applications").mock(
        return_value=httpx.Response(200, json=APPS_RESPONSE)
    )

    apps = await query_argocd.fn(
        argocd_url=ARGOCD_URL,
        api_token="test-token",
        k8s_host_id="lw-c1",
    )

    assert len(apps) == 2
    assert isinstance(apps[0], RawArgoApp)
    assert apps[0].name == "prefect-etl"
    assert apps[0].sync_status == "synced"
    assert apps[0].namespace == "prefect-etl"
    assert apps[0].host_id == "lw-c1"


@pytest.mark.asyncio
@respx.mock
async def test_query_argocd_normalizes_sync_status():
    respx.get(f"{ARGOCD_URL}/api/v1/applications").mock(
        return_value=httpx.Response(200, json=APPS_RESPONSE)
    )

    apps = await query_argocd.fn(
        argocd_url=ARGOCD_URL,
        api_token="test-token",
        k8s_host_id="lw-c1",
    )

    statuses = {a.name: a.sync_status for a in apps}
    assert statuses["prefect-etl"] == "synced"
    assert statuses["n8n-workers"] == "out-of-sync"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_argocd.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement the task**

```python
# src/etl/flows/infravision/argocd.py
from __future__ import annotations

import httpx
import structlog
from prefect import task
from prefect.cache_policies import NONE

from .models import RawArgoApp

logger = structlog.get_logger()

SYNC_STATUS_MAP = {
    "Synced": "synced",
    "OutOfSync": "out-of-sync",
    "Unknown": "failed",
}


@task(
    name="query_argocd",
    retries=3,
    retry_delay_seconds=10,
    timeout_seconds=120,
    cache_policy=NONE,
)
async def query_argocd(
    argocd_url: str,
    api_token: str,
    k8s_host_id: str = "lw-c1",
) -> list[RawArgoApp]:
    """Query ArgoCD for all managed applications."""
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        resp = await client.get(f"{argocd_url}/api/v1/applications")
        resp.raise_for_status()
        data = resp.json()

    apps: list[RawArgoApp] = []
    for item in data.get("items", []):
        metadata = item.get("metadata", {})
        spec = item.get("spec", {})
        status = item.get("status", {})
        source = spec.get("source", {})

        sync_raw = status.get("sync", {}).get("status", "Unknown")
        sync_status = SYNC_STATUS_MAP.get(sync_raw, "failed")

        apps.append(RawArgoApp(
            name=metadata["name"],
            namespace=spec.get("destination", {}).get("namespace", "default"),
            chart=source.get("chart"),
            sync_status=sync_status,
            health_status=status.get("health", {}).get("status", "Unknown"),
            host_id=k8s_host_id,
        ))

    logger.info("argocd_query_complete", app_count=len(apps))
    return apps
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_argocd.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/argocd.py tests/test_infravision_argocd.py
git commit -m "feat: add query_argocd task for infravision"
```

---

### Task 6: Implement `query_prometheus` task

**Files:**
- Create: `src/etl/flows/infravision/prometheus.py`
- Create: `tests/test_infravision_prometheus.py`

- [ ] **Step 1: Write tests with mocked HTTP**

```python
# tests/test_infravision_prometheus.py
import pytest
import httpx
import respx
from etl.flows.infravision.prometheus import query_prometheus
from etl.flows.infravision.models import RawPrometheusContainer


PROM_URL = "http://prometheus.test:9090"

QUERY_RESPONSE = {
    "status": "success",
    "data": {
        "resultType": "vector",
        "result": [
            {
                "metric": {
                    "instance": "lw-n1:9100",
                    "name": "n8n",
                    "image": "docker.n8n.io/n8nio/n8n:1.70.3",
                },
                "value": [1711900000, "1"],
            },
            {
                "metric": {
                    "instance": "lw-n1:9100",
                    "name": "postgres",
                    "image": "postgres:16.6",
                },
                "value": [1711900000, "1"],
            },
            {
                "metric": {
                    "instance": "lw-c1:9100",
                    "name": "k3s-server",
                    "image": "rancher/k3s:v1.29.0",
                },
                "value": [1711900000, "1"],
            },
        ],
    },
}


@pytest.mark.asyncio
@respx.mock
async def test_query_prometheus_returns_containers():
    respx.get(f"{PROM_URL}/api/v1/query").mock(
        return_value=httpx.Response(200, json=QUERY_RESPONSE)
    )

    containers = await query_prometheus.fn(prometheus_url=PROM_URL)

    assert len(containers) == 3
    assert isinstance(containers[0], RawPrometheusContainer)


@pytest.mark.asyncio
@respx.mock
async def test_query_prometheus_extracts_host_from_instance():
    respx.get(f"{PROM_URL}/api/v1/query").mock(
        return_value=httpx.Response(200, json=QUERY_RESPONSE)
    )

    containers = await query_prometheus.fn(prometheus_url=PROM_URL)

    hosts = {c.name: c.host for c in containers}
    assert hosts["n8n"] == "lw-n1"
    assert hosts["k3s-server"] == "lw-c1"


@pytest.mark.asyncio
@respx.mock
async def test_query_prometheus_extracts_image():
    respx.get(f"{PROM_URL}/api/v1/query").mock(
        return_value=httpx.Response(200, json=QUERY_RESPONSE)
    )

    containers = await query_prometheus.fn(prometheus_url=PROM_URL)

    n8n = next(c for c in containers if c.name == "n8n")
    assert n8n.image == "docker.n8n.io/n8nio/n8n:1.70.3"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_prometheus.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement the task**

```python
# src/etl/flows/infravision/prometheus.py
from __future__ import annotations

import httpx
import structlog
from prefect import task
from prefect.cache_policies import NONE

from .models import RawPrometheusContainer

logger = structlog.get_logger()

# PromQL to get running containers with image and host labels
CONTAINER_QUERY = 'group by (instance, name, image) (container_last_seen)'


@task(
    name="query_prometheus",
    retries=3,
    retry_delay_seconds=10,
    timeout_seconds=60,
    cache_policy=NONE,
)
async def query_prometheus(
    prometheus_url: str,
) -> list[RawPrometheusContainer]:
    """Query Prometheus for live container metadata."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{prometheus_url}/api/v1/query",
            params={"query": CONTAINER_QUERY},
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "success":
        logger.error("prometheus_query_failed", response=data)
        return []

    containers: list[RawPrometheusContainer] = []
    for result in data.get("data", {}).get("result", []):
        metric = result.get("metric", {})
        instance = metric.get("instance", "")
        # Extract hostname from instance label (e.g., "lw-n1:9100" → "lw-n1")
        host = instance.split(":")[0] if instance else "unknown"

        name = metric.get("name", "")
        image = metric.get("image", "")

        if not name:
            continue

        containers.append(RawPrometheusContainer(
            name=name,
            image=image,
            host=host,
            ports=[],  # Port data may come from a separate query if available
        ))

    logger.info("prometheus_query_complete", container_count=len(containers))
    return containers
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_prometheus.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/prometheus.py tests/test_infravision_prometheus.py
git commit -m "feat: add query_prometheus task for infravision"
```

---

### Task 7: Implement `normalize` task

**Files:**
- Create: `src/etl/flows/infravision/normalize.py`
- Create: `tests/test_infravision_normalize.py`

- [ ] **Step 1: Write tests**

```python
# tests/test_infravision_normalize.py
import pytest
from etl.flows.infravision.normalize import normalize
from etl.flows.infravision.models import (
    RawNetBoxHost, RawAnsibleService, RawArgoApp,
    RawPrometheusContainer, InfraVisionOutput,
)


HOST_COLOR_MAP = {
    "lw-c1": "hsl(0, 65%, 55%)",
    "lw-n1": "hsl(35, 80%, 55%)",
    "lw-n2": "hsl(160, 50%, 50%)",
    "lw-nas": "hsl(220, 50%, 60%)",
    "lw-main": "hsl(270, 45%, 60%)",
}


@pytest.fixture
def netbox_hosts() -> list[RawNetBoxHost]:
    return [
        RawNetBoxHost(id="lw-c1", label="lw-c1", ip="192.168.0.107", zone="primary", netbox_url="https://netbox/1/"),
        RawNetBoxHost(id="lw-n1", label="lw-n1", ip="192.168.0.105", zone="primary", netbox_url="https://netbox/2/"),
    ]


@pytest.fixture
def netbox_zones() -> list[dict]:
    return [
        {"id": "primary", "cidr": "192.168.0.0/24", "label": "PRIMARY NETWORK"},
        {"id": "nas", "cidr": "10.0.1.0/24", "label": "NAS SUBNET"},
    ]


@pytest.fixture
def ansible_services() -> list[RawAnsibleService]:
    return [
        RawAnsibleService(
            id="svc-n8n", label="n8n", description="Workflow automation",
            host_id="lw-n1", type="docker", ports=[5678],
            image="docker.n8n.io/n8nio/n8n:latest", tags=["automation"],
            playbook_path="automation/n8n-setup",
            dependencies=["svc-postgres"],
        ),
        RawAnsibleService(
            id="svc-postgres", label="postgres", description="PostgreSQL",
            host_id="lw-n1", type="docker", ports=[5432],
            image="postgres:16", tags=["infrastructure"],
            playbook_path="infrastructure/shared-postgres-setup",
            dependencies=[],
        ),
    ]


@pytest.fixture
def argocd_apps() -> list[RawArgoApp]:
    return [
        RawArgoApp(
            name="prefect-etl", namespace="prefect-etl",
            chart="prefect-etl", sync_status="synced",
            health_status="Healthy", host_id="lw-c1",
        ),
    ]


@pytest.fixture
def prometheus_containers() -> list[RawPrometheusContainer]:
    return [
        RawPrometheusContainer(name="n8n", image="docker.n8n.io/n8nio/n8n:1.70.3", host="lw-n1", ports=[5678]),
        RawPrometheusContainer(name="postgres", image="postgres:16.6", host="lw-n1", ports=[5432]),
    ]


@pytest.mark.asyncio
async def test_normalize_produces_valid_output(
    netbox_hosts, netbox_zones, ansible_services, argocd_apps, prometheus_containers,
):
    output = await normalize.fn(
        netbox_hosts=netbox_hosts,
        netbox_zones=netbox_zones,
        ansible_services=ansible_services,
        argocd_apps=argocd_apps,
        prometheus_containers=prometheus_containers,
        host_colors=HOST_COLOR_MAP,
        grafana_url="http://grafana.test",
        caddy_domain="lab.local",
        argocd_url="http://argocd.test",
        ansible_repo_url="https://github.com/user/ansible",
    )

    assert isinstance(output, InfraVisionOutput)
    assert len(output.zones) == 2
    assert len(output.hosts) == 2
    assert len(output.services) >= 3  # 2 ansible + 1 argocd


@pytest.mark.asyncio
async def test_normalize_reconciles_prometheus_image(
    netbox_hosts, netbox_zones, ansible_services, argocd_apps, prometheus_containers,
):
    output = await normalize.fn(
        netbox_hosts=netbox_hosts,
        netbox_zones=netbox_zones,
        ansible_services=ansible_services,
        argocd_apps=argocd_apps,
        prometheus_containers=prometheus_containers,
        host_colors=HOST_COLOR_MAP,
        grafana_url="http://grafana.test",
        caddy_domain="lab.local",
        argocd_url="http://argocd.test",
        ansible_repo_url="https://github.com/user/ansible",
    )

    n8n_svc = next(s for s in output.services if s.label == "n8n")
    # Prometheus image (with actual tag) should win over Ansible default
    assert n8n_svc.image == "docker.n8n.io/n8nio/n8n:1.70.3"


@pytest.mark.asyncio
async def test_normalize_creates_connections_from_dependencies(
    netbox_hosts, netbox_zones, ansible_services, argocd_apps, prometheus_containers,
):
    output = await normalize.fn(
        netbox_hosts=netbox_hosts,
        netbox_zones=netbox_zones,
        ansible_services=ansible_services,
        argocd_apps=argocd_apps,
        prometheus_containers=prometheus_containers,
        host_colors=HOST_COLOR_MAP,
        grafana_url="http://grafana.test",
        caddy_domain="lab.local",
        argocd_url="http://argocd.test",
        ansible_repo_url="https://github.com/user/ansible",
    )

    dep_connections = [c for c in output.connections if c.type == "dependency"]
    assert any(c.source == "svc-n8n" and c.target == "svc-postgres" for c in dep_connections)


@pytest.mark.asyncio
async def test_normalize_assigns_host_colors(
    netbox_hosts, netbox_zones, ansible_services, argocd_apps, prometheus_containers,
):
    output = await normalize.fn(
        netbox_hosts=netbox_hosts,
        netbox_zones=netbox_zones,
        ansible_services=ansible_services,
        argocd_apps=argocd_apps,
        prometheus_containers=prometheus_containers,
        host_colors=HOST_COLOR_MAP,
        grafana_url="http://grafana.test",
        caddy_domain="lab.local",
        argocd_url="http://argocd.test",
        ansible_repo_url="https://github.com/user/ansible",
    )

    lw_c1 = next(h for h in output.hosts if h.id == "lw-c1")
    assert lw_c1.color == "hsl(0, 65%, 55%)"


@pytest.mark.asyncio
async def test_normalize_builds_k8s_services_from_argocd(
    netbox_hosts, netbox_zones, ansible_services, argocd_apps, prometheus_containers,
):
    output = await normalize.fn(
        netbox_hosts=netbox_hosts,
        netbox_zones=netbox_zones,
        ansible_services=ansible_services,
        argocd_apps=argocd_apps,
        prometheus_containers=prometheus_containers,
        host_colors=HOST_COLOR_MAP,
        grafana_url="http://grafana.test",
        caddy_domain="lab.local",
        argocd_url="http://argocd.test",
        ansible_repo_url="https://github.com/user/ansible",
    )

    prefect = next(s for s in output.services if s.label == "prefect-etl")
    assert prefect.type == "k8s"
    assert prefect.sync_status == "synced"
    assert prefect.namespace == "prefect-etl"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_normalize.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement the task**

```python
# src/etl/flows/infravision/normalize.py
from __future__ import annotations

from datetime import datetime, timezone

import structlog
from prefect import task
from prefect.cache_policies import NONE

from .models import (
    ConnectionRecord,
    HostRecord,
    InfraVisionOutput,
    NetworkZoneRecord,
    QuickLink,
    RawArgoApp,
    RawAnsibleService,
    RawNetBoxHost,
    RawPrometheusContainer,
    ServiceRecord,
)

logger = structlog.get_logger()

DEFAULT_HOST_COLORS = {
    "lw-c1": "hsl(0, 65%, 55%)",
    "lw-n1": "hsl(35, 80%, 55%)",
    "lw-n2": "hsl(160, 50%, 50%)",
    "lw-nas": "hsl(220, 50%, 60%)",
    "lw-main": "hsl(270, 45%, 60%)",
}


def _short_ip(full_ip: str) -> str:
    """Convert '192.168.0.107' to '.107'."""
    parts = full_ip.split(".")
    return f".{parts[-1]}" if len(parts) == 4 else full_ip


def _build_quick_links(
    service: RawAnsibleService,
    caddy_domain: str,
    grafana_url: str,
    ansible_repo_url: str,
) -> list[QuickLink]:
    links: list[QuickLink] = []
    if service.ports:
        links.append(QuickLink(
            label="Open Web UI",
            url=f"https://{service.label}.{caddy_domain}",
            icon="🌐",
        ))
    if grafana_url:
        links.append(QuickLink(
            label="Grafana Dashboard",
            url=f"{grafana_url}/d/{service.label}",
            icon="📊",
        ))
    if ansible_repo_url and service.playbook_path:
        links.append(QuickLink(
            label="Ansible Playbook",
            url=f"{ansible_repo_url}/tree/main/{service.playbook_path}",
            icon="🔧",
        ))
    return links


def _build_k8s_quick_links(
    app: RawArgoApp,
    argocd_url: str,
    grafana_url: str,
) -> list[QuickLink]:
    links: list[QuickLink] = []
    if argocd_url:
        links.append(QuickLink(
            label="ArgoCD App",
            url=f"{argocd_url}/applications/{app.name}",
            icon="🚀",
        ))
    if grafana_url:
        links.append(QuickLink(
            label="Grafana Dashboard",
            url=f"{grafana_url}/d/{app.name}",
            icon="📊",
        ))
    return links


@task(
    name="normalize",
    timeout_seconds=60,
    cache_policy=NONE,
)
async def normalize(
    netbox_hosts: list[RawNetBoxHost],
    netbox_zones: list[dict],
    ansible_services: list[RawAnsibleService],
    argocd_apps: list[RawArgoApp],
    prometheus_containers: list[RawPrometheusContainer],
    host_colors: dict[str, str] | None = None,
    grafana_url: str = "",
    caddy_domain: str = "lab.local",
    argocd_url: str = "",
    ansible_repo_url: str = "",
) -> InfraVisionOutput:
    """Merge all raw data sources into the unified InfraVision schema."""
    colors = host_colors or DEFAULT_HOST_COLORS

    # Build Prometheus lookup: (container_name, host) → container
    prom_lookup: dict[tuple[str, str], RawPrometheusContainer] = {}
    for c in prometheus_containers:
        prom_lookup[(c.name, c.host)] = c

    # Build hosts
    hosts: list[HostRecord] = []
    zone_host_ids: dict[str, list[str]] = {}
    for nb_host in netbox_hosts:
        hosts.append(HostRecord(
            id=nb_host.id,
            label=nb_host.label,
            ip=_short_ip(nb_host.ip),
            full_ip=nb_host.ip,
            zone=nb_host.zone,
            color=colors.get(nb_host.id, "hsl(220, 20%, 50%)"),
            tags=[],
            netbox_url=nb_host.netbox_url,
        ))
        zone_host_ids.setdefault(nb_host.zone, []).append(nb_host.id)

    # Build zones
    zones: list[NetworkZoneRecord] = []
    for z in netbox_zones:
        zones.append(NetworkZoneRecord(
            id=z["id"],
            cidr=z["cidr"],
            label=z["label"],
            host_ids=zone_host_ids.get(z["id"], []),
        ))

    # Build services from Ansible (Docker)
    services: list[ServiceRecord] = []
    all_tags: set[str] = set()

    for ansible_svc in ansible_services:
        # Reconcile with Prometheus: prefer live image
        prom_match = prom_lookup.get((ansible_svc.label, ansible_svc.host_id))
        image = ansible_svc.image
        if prom_match and prom_match.image:
            image = prom_match.image

        ports = ansible_svc.ports
        if prom_match and prom_match.ports:
            ports = prom_match.ports

        quick_links = _build_quick_links(ansible_svc, caddy_domain, grafana_url, ansible_repo_url)

        services.append(ServiceRecord(
            id=ansible_svc.id,
            label=ansible_svc.label,
            description=ansible_svc.description,
            host_id=ansible_svc.host_id,
            type="docker",
            ports=ports,
            image=image,
            dependencies=ansible_svc.dependencies,
            tags=ansible_svc.tags,
            quick_links=quick_links,
            ansible_playbook=ansible_svc.playbook_path,
        ))
        all_tags.update(ansible_svc.tags)

    # Build services from ArgoCD (K8s)
    existing_ids = {s.id for s in services}
    for app in argocd_apps:
        svc_id = f"svc-{app.name}"
        if svc_id in existing_ids:
            # Update existing service with K8s info
            for svc in services:
                if svc.id == svc_id:
                    svc.type = "k8s"
                    svc.namespace = app.namespace
                    svc.chart = app.chart
                    svc.sync_status = app.sync_status
                    svc.argocd_app = f"{argocd_url}/applications/{app.name}" if argocd_url else None
                    break
        else:
            quick_links = _build_k8s_quick_links(app, argocd_url, grafana_url)
            services.append(ServiceRecord(
                id=svc_id,
                label=app.name,
                description=f"{app.name} (K8s)",
                host_id=app.host_id,
                type="k8s",
                ports=[],
                namespace=app.namespace,
                chart=app.chart,
                sync_status=app.sync_status,
                dependencies=[],
                tags=["k8s"],
                quick_links=quick_links,
                argocd_app=f"{argocd_url}/applications/{app.name}" if argocd_url else None,
            ))
            all_tags.add("k8s")

    # Collect host tags from their services
    host_tags: dict[str, set[str]] = {}
    for svc in services:
        host_tags.setdefault(svc.host_id, set()).update(svc.tags)
    for host in hosts:
        host.tags = sorted(host_tags.get(host.id, set()))

    # Build connections from service dependencies
    connections: list[ConnectionRecord] = []
    for svc in services:
        for dep_id in svc.dependencies:
            connections.append(ConnectionRecord(
                source=svc.id,
                target=dep_id,
                type="dependency",
            ))

    logger.info(
        "normalize_complete",
        host_count=len(hosts),
        service_count=len(services),
        connection_count=len(connections),
    )

    return InfraVisionOutput(
        metadata={
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "sources": {
                "netbox": f"{len(netbox_hosts)} hosts",
                "ansible": f"{len(ansible_services)} services",
                "argocd": f"{len(argocd_apps)} apps",
                "prometheus": f"{len(prometheus_containers)} containers",
            },
        },
        zones=zones,
        hosts=hosts,
        services=services,
        connections=connections,
        tags=sorted(all_tags),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_normalize.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/normalize.py tests/test_infravision_normalize.py
git commit -m "feat: add normalize task for infravision"
```

---

### Task 8: Implement the flow and register it

**Files:**
- Create: `src/etl/flows/infravision/flow.py`
- Modify: `src/etl/flows/registry.py`
- Modify: `src/etl/flows/__init__.py`

- [ ] **Step 1: Add to flow allowlist**

In `src/etl/flows/registry.py`, add `"infravision-generate"` to `FLOW_ALLOWLIST`:

```python
FLOW_ALLOWLIST: set[str] = {"synthesis", "infravision-generate"}
```

- [ ] **Step 2: Create the flow**

```python
# src/etl/flows/infravision/flow.py
from __future__ import annotations

from uuid import UUID

import structlog
from prefect import flow

from etl.config import Settings
from etl.flows.registry import register_flow

from .argocd import query_argocd
from .ansible import parse_ansible
from .models import InfraVisionOutput
from .netbox import query_netbox
from .normalize import normalize
from .prometheus import query_prometheus

logger = structlog.get_logger()


@register_flow("infravision-generate")
@flow(name="infravision-generate")
async def infravision_generate(
    run_id: UUID,
    params: dict | None = None,
    settings: Settings | None = None,
) -> str:
    """Generate infravision-data.json from NetBox, Ansible, ArgoCD, and Prometheus."""
    if settings is None:
        settings = Settings()

    logger.info("infravision_generate_start", run_id=str(run_id))

    # Run all four data-gathering tasks in parallel
    import asyncio

    netbox_task = query_netbox(
        netbox_url=settings.netbox_url,
        api_token=settings.netbox_api_token.get_secret_value(),
    )
    ansible_task = parse_ansible(
        repo_path=settings.ansible_repo_path,
    )
    argocd_task = query_argocd(
        argocd_url=settings.argocd_url,
        api_token=settings.argocd_api_token.get_secret_value(),
    )
    prometheus_task = query_prometheus(
        prometheus_url=settings.prometheus_url,
    )

    (netbox_hosts, netbox_zones), ansible_services, argocd_apps, prom_containers = (
        await asyncio.gather(
            netbox_task,
            ansible_task,
            argocd_task,
            prometheus_task,
        )
    )

    # Normalize all sources into unified schema
    output: InfraVisionOutput = await normalize(
        netbox_hosts=netbox_hosts,
        netbox_zones=netbox_zones,
        ansible_services=ansible_services,
        argocd_apps=argocd_apps,
        prometheus_containers=prom_containers,
        grafana_url=settings.grafana_url,
        caddy_domain=settings.caddy_domain,
        argocd_url=settings.argocd_url,
        ansible_repo_url=settings.ansible_repo_url,
    )

    # Serialize to JSON string
    json_output = output.model_dump_json(by_alias=True, indent=2)

    logger.info(
        "infravision_generate_complete",
        run_id=str(run_id),
        host_count=len(output.hosts),
        service_count=len(output.services),
        json_size=len(json_output),
    )

    return json_output
```

- [ ] **Step 3: Register the import**

In `src/etl/flows/__init__.py`, add the import:

```python
import etl.flows.infravision.flow  # noqa: F401
```

- [ ] **Step 4: Verify the flow registers**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -c "from etl.flows.registry import list_flows; print(list_flows())"`
Expected: Output includes `'infravision-generate'` alongside `'synthesis'`.

- [ ] **Step 5: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add src/etl/flows/infravision/flow.py src/etl/flows/registry.py src/etl/flows/__init__.py
git commit -m "feat: add infravision-generate flow"
```

---

### Task 9: Add PyYAML dependency

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add PyYAML to dependencies**

The `parse_ansible` task uses `yaml.safe_load()`. Add `pyyaml` to the project dependencies in `pyproject.toml`:

```toml
dependencies = [
    # ... existing deps ...
    "pyyaml>=6.0",
]
```

- [ ] **Step 2: Install and verify**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && pip install -e ".[dev]"`
Expected: Installs successfully including pyyaml.

- [ ] **Step 3: Run all infravision tests**

Run: `cd /home/kamil-rybacki/Code/prefect-etl && python -m pytest tests/test_infravision_*.py -v`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/kamil-rybacki/Code/prefect-etl
git add pyproject.toml
git commit -m "chore: add pyyaml dependency for ansible parsing"
```

---

### Task 10: n8n workflow — `infravision-update`

**Files:**
- This task creates an n8n workflow. No local files — configured via n8n MCP.

- [ ] **Step 1: Design the workflow nodes**

The n8n workflow `infravision-update` has these nodes:

1. **Schedule Trigger** — Cron: `0 */6 * * *` (every 6 hours)
2. **Manual Trigger** — Webhook for on-demand runs
3. **Trigger Prefect Flow** — HTTP POST to `http://192.168.0.107:8000/api/flows/infravision-generate/runs` with bearer token auth. Body: `{"params": {}}`
4. **Poll for Completion** — Loop: GET `/api/flows/infravision-generate/runs/{{ run_id }}` every 30s until status is `completed` or `failed`. Max 20 iterations (10 min timeout).
5. **Fetch JSON Result** — On success, extract the JSON output from the flow result.
6. **Commit to GitHub** — Use GitHub API (PUT `/repos/{owner}/infravision/contents/public/infravision-data.json`) to commit the JSON file. Requires GitHub token from Vault.
7. **Error Notification** — On failure, send notification (e.g., Discord or Slack webhook).

- [ ] **Step 2: Create the workflow via n8n MCP**

Use `mcp__n8n__execute_workflow` or manual n8n UI setup to create and configure the workflow with the nodes described above.

Note: The exact n8n node configuration depends on the n8n version and available nodes. This step requires manual configuration or an n8n workflow JSON import. The workflow JSON should be saved to `/home/kamil-rybacki/Code/n8n-workflows/infravision-update.json` for version control.

- [ ] **Step 3: Test the workflow manually**

Trigger the workflow via n8n UI or webhook. Verify:
- Prefect flow is triggered
- JSON is generated
- File is committed to GitHub
- GitHub Pages rebuilds

- [ ] **Step 4: Commit the workflow definition**

```bash
cd /home/kamil-rybacki/Code/n8n-workflows
git add infravision-update.json
git commit -m "feat: add infravision-update n8n workflow"
```
