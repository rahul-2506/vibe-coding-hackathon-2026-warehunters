import urllib.parse
import re
import requests
from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding='utf-8')

def test_scrape_classes():
    product_name = "The Derma Co 1% Salicylic Acid Face Wash"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    }
    url = f"https://www.flipkart.com/search?q={urllib.parse.quote(product_name)}"
    print(f"URL: {url}")
    
    response = requests.get(url, headers=headers, timeout=10)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Find the first few product titles
    titles = soup.find_all('a', title=True)
    for t in titles[:5]:
        title_text = t.get('title')
        if "Derma" in title_text or "Face Wash" in title_text:
            print(f"Found Product Title: {title_text}")
            # Find the parent div and look for prices inside it
            parent = t.find_parent('div', class_=re.compile(r"slAVV4|.*")) 
            # Actually, let's just find the next sibling or parent that contains ₹
            if parent:
                price_divs = parent.find_all('div', string=re.compile(r"₹\d+"))
                for pd in price_divs:
                    print(f"  Price text: {pd.get_text()} | Class: {pd.get('class')}")
    
    # General search for all elements with class starting with 'Nx9' or similar
    print("--- Searching for any class containing 'price' or matching typical patterns ---")
    nodes = soup.find_all(string=re.compile(r"₹\d+"))
    for node in nodes[:10]:
        parent = node.parent
        print(f"Text: {node.strip()} | Parent Tag: {parent.name} | Parent Class: {parent.get('class')}")

if __name__ == "__main__":
    test_scrape_classes()
