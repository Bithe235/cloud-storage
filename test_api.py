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

def test_endpoint(name, method, endpoint, payload=None, files=None, params=None):
    url = f"{API_BASE_URL}{endpoint}"
    print(f"Testing {name}: {method} {url}")
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method == "POST":
            if files:
                # Remove Content-Type for multipart/form-data
                h = headers.copy()
                del h["Content-Type"]
                response = requests.post(url, headers=h, data=payload, files=files)
            else:
                response = requests.post(url, headers=headers, json=payload)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, params=params)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=payload)
        else:
            print(f"Unsupported method: {method}")
            return None

        if response.status_code >= 400:
            print(f"Error Response ({response.status_code}): {response.text}")

        if response.text:
            try:
                print(json.dumps(response.json(), indent=2))
                return response.json()
            except:
                return response.text
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def run_tests():
    print("=== STARTING API ENDPOINT TESTS ===\n")

    # 1. List Buckets
    buckets = test_endpoint("List Buckets", "GET", "/api/buckets")
    
    # 2. Create Bucket
    bucket_name = f"api-test-{int(time.time())}"
    new_bucket = test_endpoint("Create Bucket", "POST", "/api/buckets", payload={"name": bucket_name, "region": "us-east-1"})
    
    if not new_bucket or "id" not in new_bucket:
        print("!! Bucket creation failed, skipping further tests.")
        return

    bucket_id = new_bucket["id"]

    # 3. Get Bucket
    test_endpoint("Get Bucket", "GET", f"/api/buckets/{bucket_id}")

    # 4. List Files (Empty)
    test_endpoint("List Files (Initial)", "GET", f"/api/buckets/{bucket_id}/files", params={"path": ""})

    # 5. Upload File
    test_file_content = b"This is a test file for API endpoint validation."
    files = {"file": ("test_api.txt", test_file_content, "text/plain")}
    test_endpoint("Upload File", "POST", f"/api/buckets/{bucket_id}/files", payload={"path": ""}, files=files)

    # 6. List Files (After Upload)
    files_list = test_endpoint("List Files (After Upload)", "GET", f"/api/buckets/{bucket_id}/files", params={"path": ""})

    # 7. Delete File
    test_endpoint("Delete File", "DELETE", f"/api/buckets/{bucket_id}/files", params={"path": "test_api.txt"})

    # 8. Delete Bucket
    test_endpoint("Delete Bucket", "DELETE", f"/api/buckets/{bucket_id}")

    print("\n=== API ENDPOINT TESTS COMPLETED ===")

if __name__ == "__main__":
    run_tests()
