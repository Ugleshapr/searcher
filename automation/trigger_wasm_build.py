#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Внешний триггер для workflow "Build and Pack WASM Base".

Используется, когда внутренний cron GitHub Actions задерживает запуски
на много часов. Запускайте этот скрипт из любого внешнего планировщика
(cron-job.org, Cloudflare Workers Cron, systemd-timer, вашего сервера)
в нужное время (для 06:35 MSK — 03:35 UTC).

Требуется:
  - переменная окружения GITHUB_TOKEN (fine-grained PAT с правом Actions:write)
  - репозиторий Ugleshapr/searcher (или задайте GITHUB_REPOSITORY)
"""

import json
import os
import sys
import urllib.error
import urllib.request

REPO = os.environ.get("GITHUB_REPOSITORY", "Ugleshapr/searcher")
WORKFLOW_NAME = "Build and Pack WASM Base"
TOKEN = os.environ.get("GITHUB_TOKEN")


def api_request(url, method="GET", data=None):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {TOKEN}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "searcher-wasm-trigger/1.0",
    }
    if data is not None:
        data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8") if resp.status != 204 else ""
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        raise


def get_workflow_id():
    status, body = api_request(f"https://api.github.com/repos/{REPO}/actions/workflows")
    data = json.loads(body)
    for wf in data.get("workflows", []):
        if wf["name"] == WORKFLOW_NAME:
            return wf["id"]
    raise RuntimeError(f"Workflow '{WORKFLOW_NAME}' not found in {REPO}")


def dispatch():
    wid = get_workflow_id()
    url = f"https://api.github.com/repos/{REPO}/actions/workflows/{wid}/dispatches"
    status, _ = api_request(url, method="POST", data={"ref": "main"})
    if status in (204, 202):
        print(f"OK: dispatched '{WORKFLOW_NAME}' on main for {REPO}")
    else:
        print(f"Unexpected status: {status}", file=sys.stderr)
        sys.exit(1)


def main():
    if not TOKEN:
        print("Error: GITHUB_TOKEN environment variable is required.", file=sys.stderr)
        sys.exit(1)
    dispatch()


if __name__ == "__main__":
    main()
