import requests
import json

BASE_URL = "http://localhost:8080/api"
READ_ONLY_KEY = "pk_204d8fb40fc54a2af89ca28db3ddf2ee3fc355d12d9719aa2c9ee67c89f300a1"
FULL_ACCESS_KEY = "pk_3b22ff884815a3c5b9d6cecf52b4098972a0b2fdd59741e37296258de84af0a0"

def test_key(name, key):
    print(f"\n--- Testing {name} ---")
    headers = {"X-API-Key": key}
    
    # 1. READ
    r = requests.get(f"{BASE_URL}/buckets", headers=headers)
    print(f"GET /buckets    | Expected: 200 | Got: {r.status_code}")

    # 2. WRITE
    payload = {"name": f"test-perm-{name.lower().replace(' ', '-')}", "region": "us-east-1"}
    r = requests.post(f"{BASE_URL}/buckets", headers=headers, json=payload)
    print(f"POST /buckets   | Got: {r.status_code}")
    
    created_id = None
    if r.status_code in [200, 201]:
        try:
            data = r.json()
            created_id = data.get("id") or data.get("bucket", {}).get("id")
        except: pass

    # 3. DELETE
    target_id = created_id if created_id else "00000000-0000-0000-0000-000000000000"
    r = requests.delete(f"{BASE_URL}/buckets/{target_id}", headers=headers)
    # 404/502/204/200 are all "passed permission" if they are not 403
    status_msg = "PASSED PERMISSION" if r.status_code != 403 else "FORBIDDEN"
    print(f"DELETE /buckets | Got: {r.status_code} ({status_msg})")

print("API Permission Verification")
test_key("Read-Only Key", READ_ONLY_KEY)
test_key("Full-Access Key", FULL_ACCESS_KEY)
