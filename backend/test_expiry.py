import requests
import json

BASE_URL = "http://localhost:8080/api"
EMAIL = "fahadakash@protonmail.com"
PASSWORD = "password123" # I assume this is the password based on previous context or common patterns

def test_expiry():
    print(f"--- Testing Expiry for {EMAIL} ---")
    
    # 1. Login to get token
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": EMAIL,
        "password": PASSWORD
    })
    
    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.text}")
        return
        
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Try to list buckets (Should be blocked by ExpiryGuard)
    print("Testing GET /buckets (Should be blocked)...")
    resp = requests.get(f"{BASE_URL}/buckets", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Body: {resp.json()}")
    
    # 3. Try to get billing info (Should be ALLOWED)
    print("\nTesting GET /billing (Should be allowed)...")
    resp = requests.get(f"{BASE_URL}/billing", headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        print(f"Expired: {resp.json().get('isExpired')}")

if __name__ == "__main__":
    test_expiry()
