import requests
import json

try:
    res = requests.get('http://127.0.0.1:8001/price/search?product=The+Derma+Co+2%25+Salicylic+Acid')
    data = res.json()
    print("Scraper response:")
    print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print("Error:", e)
