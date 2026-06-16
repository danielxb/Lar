#!/usr/bin/env python3
"""Writes system stats to data/system_stats.json. Run via launchd every 60s."""
import json, subprocess, os, time
from pathlib import Path

DATA = Path(__file__).parent.parent / "data" / "system_stats.json"

def get_stats():
    # CPU usage (1s sample)
    top = subprocess.run(["top", "-l", "1", "-n", "0"], capture_output=True, text=True)
    cpu_line = [l for l in top.stdout.splitlines() if "CPU usage" in l]
    cpu = cpu_line[0] if cpu_line else "unknown"

    # Memory (matches macOS Activity Monitor "Used")
    page_size = 16384
    vm = subprocess.run(["vm_stat"], capture_output=True, text=True)
    for line in vm.stdout.splitlines():
        if "page size of" in line:
            page_size = int(''.join(c for c in line.split("page size of")[1] if c.isdigit()))
            break
    wired = compressed = 0
    for line in vm.stdout.splitlines():
        if "Pages wired" in line:
            wired = int(line.split(":")[1].strip().rstrip("."))
        if "compressor" in line:
            compressed = int(line.split(":")[1].strip().rstrip("."))
    sysctl = subprocess.run(["sysctl", "-n", "vm.page_pageable_internal_count", "vm.page_purgeable_count"], capture_output=True, text=True)
    vals = sysctl.stdout.strip().split("\n")
    app_pages = int(vals[0]) - int(vals[1])
    total_mem = int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True).stdout.strip())
    used = (app_pages + wired + compressed) * page_size
    mem_pct = round(used / total_mem * 100, 1)
    mem_gb = round(total_mem / 1073741824, 1)
    used_gb = round(used / 1073741824, 1)
    mem_pct = round(used / total_mem * 100, 1)
    mem_gb = round(total_mem / 1073741824, 1)
    used_gb = round(used / 1073741824, 1)

    # Disk
    df = subprocess.run(["df", "-H", "/"], capture_output=True, text=True)
    disk_line = df.stdout.splitlines()[-1].split()
    disk_total = disk_line[1]
    disk_used = disk_line[2]
    disk_pct = disk_line[4]

    # Uptime
    uptime = subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()

    # Docker containers
    docker = subprocess.run(["docker", "ps", "--format", "{{.Names}}: {{.Status}}"], capture_output=True, text=True)
    containers = [l for l in docker.stdout.strip().splitlines() if l]

    return {
        "cpu": cpu,
        "memory": {"used_gb": used_gb, "total_gb": mem_gb, "pct": mem_pct},
        "disk": {"used": disk_used, "total": disk_total, "pct": disk_pct},
        "uptime": uptime,
        "containers": containers,
        "updated": time.strftime("%Y-%m-%dT%H:%M:%S")
    }

if __name__ == "__main__":
    DATA.write_text(json.dumps(get_stats(), indent=2))
