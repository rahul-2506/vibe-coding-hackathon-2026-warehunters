import urllib.parse
import re
import requests
from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding='utf-8')

def test_scrape():
    product_name = "The Derma Co 1% Salicylic Acid Face Wash 300ml"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    }
    
    query = urllib.parse.quote(product_name)
    url = f"https://www.flipkart.com/search?q={query}"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Method A: Try typical price classes
        prices = []
        price_elements = soup.find_all(class_=re.compile(r"(_30jeq3|_1V3w5y|Nx9bpf)"))
        print("Price elements found:")
        for elem in price_elements:
            text = elem.get_text()
            print(f"  - {text}")
            if '₹' in text:
                prices.append(text)
                
        # Method B: If no price classes found, search for string matching ₹xxx
        if not prices:
            text_nodes = soup.find_all(string=re.compile(r"₹\d+"))
            for node in text_nodes:
                prices.append(node.strip())
                
        for p in prices:
            clean_price = re.sub(r"[^\d]", "", p)
            if clean_price:
                print(f"Final extracted price: {clean_price}")
                return
                
        print("No price found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_scrape()
