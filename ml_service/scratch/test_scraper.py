import requests
from bs4 import BeautifulSoup
import urllib.parse
import re

def scrape_flipkart(product_name):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    query = urllib.parse.quote(product_name)
    url = f"https://www.flipkart.com/search?q={query}"
    print(f"Scraping Flipkart: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Response status: {response.status_code}")
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Flipkart price classes often change, but let's try common selectors:
        # 1. Class starting with _30jeq3 or similar (commonly used for price)
        # 2. Look for any text containing ₹ followed by numbers
        prices = []
        
        # Method A: Try typical price classes
        price_elements = soup.find_all(class_=re.compile(r"(_30jeq3|_1V3w5y|Nx9bpf)"))
        for elem in price_elements:
            text = elem.get_text()
            if '₹' in text:
                prices.append(text)
                
        # Method B: If no price classes found, search for text matching ₹xxx
        if not prices:
            text_nodes = soup.find_all(string=re.compile(r"₹\d+"))
            for node in text_nodes:
                prices.append(node.strip())
                
        # Clean prices to ascii for printing
        ascii_prices = [p.replace('₹', 'Rs. ') for p in prices]
        print(f"Found price texts: {ascii_prices}")
        
        # Clean and extract first price
        for p in prices:
            clean_price = re.sub(r"[^\d]", "", p)
            if clean_price:
                return int(clean_price)
                
        return None
    except Exception as e:
        print(f"Error scraping Flipkart: {e}")
        return None

if __name__ == "__main__":
    p_name = "Himalaya Purifying Neem Facewash 150ml"
    price = scrape_flipkart(p_name)
    print(f"Scraped Price: {price}")
