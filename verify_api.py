import requests
import json

API_BASE_URL = "https://server.fahadakash.com/penta"
API_KEY = "pk_42c467ac6e6344393315d2558c1a175933d87355fcd941222eae690f2c64c64d"

headers = {"X-API-Key": API_KEY}

def run():
    print("=== Production API Verification ===")
    
    # 1. Test Auth & List
    res = requests.get(f"{API_BASE_URL}/api/buckets", headers=headers)
    print(f"Buckets List: {res.status_code}")
    if res.status_code != 200: return print(f"Auth Failed: {res.text}")
    
    buckets = res.json()
    if not buckets: return print("No buckets found to test files.")
    
    # 2. Test File List for existing bucket
    bid = buckets[0]['id']
    name = buckets[0]['name']
    print(f"Testing Bucket: {name} ({bid})")
    
    fres = requests.get(f"{API_BASE_URL}/api/buckets/{bid}/files", headers=headers, params={"path": ""})
    print(f"Files List: {fres.status_code}")
    if fres.status_code == 200:
        files = fres.json()
        print(f"Found {len(files)} items in root.")
    else:
        print(f"File List Failed: {fres.text}")

    print("=== Verification Complete ===")

if __name__ == "__main__": run()
