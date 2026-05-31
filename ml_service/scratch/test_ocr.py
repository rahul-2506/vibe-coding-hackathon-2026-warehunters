import requests
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
test_images = ["test_derma.png", "test_himalaya.png", "test_mamaearth.png"]
url = "http://localhost:8000/ocr_search"

print("--- OCR SEARCH SYSTEM TEST ---")

for img_name in test_images:
    path = os.path.join(base_dir, img_name)
    print(f"\nTesting: {img_name}")
    
    if os.path.exists(path):
        with open(path, 'rb') as f:
            files = {'image': f}
            try:
                response = requests.post(url, files=files)
                if response.status_code == 200:
                    results = response.json()
                    print(f"Status: Success (200)")
                    if results:
                        print(f"Found {len(results)} products:")
                        for p in results:
                            print(f"- {p['name']} (Match: {p['matchScore']}%)")
                            print(f"  Extracted Text: \"{p.get('ocr_text', 'N/A')}\"")
                    else:
                        print("Result: No products found (Empty list)")
                else:
                    print(f"Status: Error ({response.status_code})")
                    print(f"Message: {response.text}")
            except Exception as e:
                print(f"Request Error: {e}")
    else:
        print(f"File not found: {path}")

print("\n--- TEST COMPLETE ---")
