import requests
import os
import json
import time

API_BASE_URL = "https://server.fahadakash.com/penta"
API_KEY = "pk_42c467ac6e6344393315d2558c1a175933d87355fcd941222eae690f2c64c64d"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def test(name, method, endpoint, payload=None, files=None, params=None):
    url = f"{API_BASE_URL}{endpoint}"
    print(f"\n[TEST] {name} ({method} {endpoint})")
    try:
        h = headers.copy()
        if files: del h["Content-Type"]
        
        if method == "GET": resp = requests.get(url, headers=h, params=params)
        elif method == "POST": resp = requests.post(url, headers=h, json=payload if not files else None, data=payload if files else None, files=files)
        elif method == "DELETE": resp = requests.delete(url, headers=h, params=params)
        
        print(f"Status: {resp.status_code}")
        if resp.status_code >= 400: print(f"Error: {resp.text}")
        return resp.json() if resp.text and "application/json" in resp.headers.get("Content-Type", "") else resp.text
    except Exception as e:
        print(f"Exception: {e}")
        return None

def run():
    print("=== API AUDIT START ===")
    
    # 1. Auth/Buckets
    buckets = test("List Buckets", "GET", "/api/buckets")
    
    # 2. CRUD Bucket
    bname = f"audit-{int(time.time())}"
    nb = test("Create Bucket", "POST", "/api/buckets", payload={"name": bname, "region": "us-east-1"})
    if not nb or 'id' not in nb: return print("Aborting: Create Bucket failed")
    bid = nb['id']
    
    # 3. File Ops
    test("List Files (Empty)", "GET", f"/api/buckets/{bid}/files", params={"path": ""})
    
    fcontent = b"Health check " + bname.encode()
    files = {"file": ("health.txt", fcontent, "text/plain")}
    test("Upload File", "POST", f"/api/buckets/{bid}/files", payload={"path": ""}, files=files)
    
    test("List Files (Full)", "GET", f"/api/buckets/{bid}/files", params={"path": ""})
    
    # 4. Cleanup
    test("Delete File", "DELETE", f"/api/buckets/{bid}/files", params={"path": "health.txt"})
    test("Delete Bucket", "DELETE", f"/api/buckets/{bid}")
    
    print("\n=== API AUDIT COMPLETE ===")

if __name__ == "__main__": run()
