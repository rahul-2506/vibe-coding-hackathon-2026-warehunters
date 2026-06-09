import re
import os
import time
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from serpapi import GoogleSearch
from dotenv import load_dotenv

load_dotenv()

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
if not SERPAPI_KEY:
    # Set a dummy key to prevent server crash during offline testing, but raise warning
    print("WARNING: SERPAPI_KEY not set in .env file. Using placeholder key.")
    SERPAPI_KEY = "dummy_key_for_testing"

app = FastAPI(title="ReviewLens Price Scraper", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.google.com/",
}


# ──────────────────────────────────────────────────────────────
# STEP 1: SerpAPI — Find Exact Product URLs
# ──────────────────────────────────────────────────────────────

def serpapi_amazon_url(product_name: str) -> dict:
    """
    Use SerpAPI Google Shopping to get Amazon.in product URL + price.
    Falls back to organic search if shopping results don't have Amazon.
    """
    try:
        # First try: Google Shopping (most reliable for prices)
        params = {
            "engine": "google_shopping",
            "q": product_name,
            "api_key": SERPAPI_KEY,
            "gl": "in",
            "hl": "en",
        }
        search = GoogleSearch(params)
        results = search.get_dict()

        shopping = results.get("shopping_results", [])
        for item in shopping:
            link = item.get("link", "") or item.get("product_link", "")
            source = item.get("source", "").lower()
            if "amazon" in source or "amazon.in" in link:
                return {
                    "url": link,
                    "title": item.get("title", ""),
                    "serpapi_price": item.get("price", None),
                }

        # Fallback: organic search
        params2 = {
            "engine": "google",
            "q": f"{product_name} site:amazon.in buy",
            "api_key": SERPAPI_KEY,
            "num": 5,
            "gl": "in",
            "hl": "en",
        }
        search2 = GoogleSearch(params2)
        results2 = search2.get_dict()

        for result in results2.get("organic_results", []):
            link = result.get("link", "")
            if "amazon.in" in link and ("/dp/" in link or "/gp/product/" in link):
                return {
                    "url": link,
                    "title": result.get("title", ""),
                    "serpapi_price": None,
                }

        return {"url": None, "title": None, "serpapi_price": None, "error": "No Amazon product found"}

    except Exception as e:
        return {"url": None, "title": None, "serpapi_price": None, "error": str(e)}


def serpapi_flipkart_url(product_name: str) -> dict:
    """
    Use SerpAPI organic search to get Flipkart product URL.
    """
    try:
        params = {
            "engine": "google",
            "q": f"{product_name} site:flipkart.com",
            "api_key": SERPAPI_KEY,
            "num": 5,
            "gl": "in",
            "hl": "en",
        }
        search = GoogleSearch(params)
        results = search.get_dict()

        for result in results.get("organic_results", []):
            link = result.get("link", "")
            if "flipkart.com" in link and "/p/" in link:
                return {
                    "url": link,
                    "title": result.get("title", ""),
                    "serpapi_price": None,
                }

        return {"url": None, "title": None, "serpapi_price": None, "error": "No Flipkart product found"}

    except Exception as e:
        return {"url": None, "title": None, "serpapi_price": None, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# STEP 2: Scrape Price from Exact URL
# ──────────────────────────────────────────────────────────────

def scrape_amazon_price(url: str) -> dict:
    """Scrape price from Amazon.in product page with multiple fallback selectors."""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        resp = session.get(url, timeout=12)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        price = None

        # Selector 1: main price whole
        tag = soup.select_one("span.a-price-whole")
        if tag:
            raw = tag.get_text(strip=True).replace(",", "").rstrip(".")
            if raw.isdigit():
                price = int(raw)

        # Selector 2: core price display block
        if not price:
            tag = soup.select_one(
                "#corePriceDisplay_desktop_feature_div span.a-price-whole"
            )
            if tag:
                raw = tag.get_text(strip=True).replace(",", "").rstrip(".")
                if raw.isdigit():
                    price = int(raw)

        # Selector 3: twister (variant/size selector price)
        if not price:
            tag = soup.select_one("#twister-plus-price-data-price")
            if tag:
                try:
                    price = int(float(tag.get("value", "0").replace(",", "")))
                except ValueError:
                    pass

        # Selector 4: meta tag
        if not price:
            meta = soup.find("meta", {"property": "product:price:amount"})
            if meta and meta.get("content"):
                try:
                    price = int(float(meta["content"]))
                except ValueError:
                    pass

        # Selector 5: regex on raw HTML (last resort)
        if not price:
            match = re.search(r'"priceAmount"\s*:\s*([\d.]+)', resp.text)
            if match:
                try:
                    price = int(float(match.group(1)))
                except ValueError:
                    pass

        # MRP / original price
        mrp = None
        mrp_tag = soup.select_one("span.a-price.a-text-price span.a-offscreen")
        if mrp_tag:
            raw_mrp = mrp_tag.get_text(strip=True).replace("₹", "").replace(",", "").strip()
            try:
                mrp = int(float(raw_mrp))
            except ValueError:
                pass

        # Product title
        title_tag = soup.select_one("#productTitle")
        title = title_tag.get_text(strip=True) if title_tag else None

        # Rating
        rating = None
        rating_tag = soup.select_one("span.a-icon-alt")
        if rating_tag:
            rating_text = rating_tag.get_text(strip=True)
            match = re.search(r"([\d.]+) out of", rating_text)
            if match:
                rating = float(match.group(1))

        return {
            "platform": "amazon",
            "url": url,
            "title": title,
            "price": price,
            "mrp": mrp,
            "rating": rating,
            "currency": "INR",
            "symbol": "₹",
        }

    except requests.exceptions.HTTPError as e:
        return {
            "platform": "amazon",
            "url": url,
            "price": None,
            "error": f"HTTP {e.response.status_code} - Amazon blocked this request (try from localhost)",
        }
    except Exception as e:
        return {"platform": "amazon", "url": url, "price": None, "error": str(e)}


def scrape_flipkart_price(url: str) -> dict:
    """Scrape price from Flipkart product page with multiple fallback selectors."""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        resp = session.get(url, timeout=12, allow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        price = None

        # Selector 1: Nx9bqj (2024 Flipkart layout)
        tag = soup.select_one("div.Nx9bqj")
        if tag:
            raw = tag.get_text(strip=True).replace("₹", "").replace(",", "").strip()
            try:
                price = int(float(raw))
            except ValueError:
                pass

        # Selector 2: _30jeq3 (older layout)
        if not price:
            tag = soup.select_one("div._30jeq3")
            if tag:
                raw = tag.get_text(strip=True).replace("₹", "").replace(",", "").strip()
                try:
                    price = int(float(raw))
                except ValueError:
                    pass

        # Selector 3: _16Jk6d
        if not price:
            tag = soup.select_one("div._16Jk6d")
            if tag:
                raw = tag.get_text(strip=True).replace("₹", "").replace(",", "").strip()
                try:
                    price = int(float(raw))
                except ValueError:
                    pass

        # Selector 4: check all divs with ₹ symbol, pick the first valid one
        if not price:
            for div in soup.find_all("div"):
                text = div.get_text(strip=True)
                if text.startswith("₹") and len(text) < 12:
                    raw = text.replace("₹", "").replace(",", "").strip()
                    try:
                        candidate = int(float(raw))
                        if candidate > 0:
                            price = candidate
                            break
                    except ValueError:
                        pass

        # Selector 5: JSON-LD structured data
        if not price:
            for script in soup.find_all("script", type="application/ld+json"):
                try:
                    import json
                    data = json.loads(script.string)
                    offers = data.get("offers", {})
                    if isinstance(offers, list):
                        offers = offers[0]
                    p = offers.get("price")
                    if p:
                        price = int(float(str(p)))
                        break
                except Exception:
                    pass

        # MRP
        mrp = None
        mrp_tag = soup.select_one("div._3I9_wc") or soup.select_one("div.yRaY8j")
        if mrp_tag:
            raw_mrp = mrp_tag.get_text(strip=True).replace("₹", "").replace(",", "").strip()
            try:
                mrp = int(float(raw_mrp))
            except ValueError:
                pass

        # Title
        title_tag = (
            soup.select_one("span.B_NuCI")
            or soup.select_one("h1.yhB1nd")
            or soup.select_one("h1")
        )
        title = title_tag.get_text(strip=True) if title_tag else None

        # Rating
        rating = None
        rating_tag = soup.select_one("div._3LWZlK") or soup.select_one("div.XQDdHH")
        if rating_tag:
            try:
                rating = float(rating_tag.get_text(strip=True))
            except ValueError:
                pass

        return {
            "platform": "flipkart",
            "url": url,
            "title": title,
            "price": price,
            "mrp": mrp,
            "rating": rating,
            "currency": "INR",
            "symbol": "₹",
        }

    except requests.exceptions.HTTPError as e:
        return {
            "platform": "flipkart",
            "url": url,
            "price": None,
            "error": f"HTTP {e.response.status_code}",
        }
    except Exception as e:
        return {"platform": "flipkart", "url": url, "price": None, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# Helper — discount %
# ──────────────────────────────────────────────────────────────

def calc_discount(price, mrp):
    if price and mrp and mrp > price:
        return round(((mrp - price) / mrp) * 100, 1)
    return None


# ──────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "ReviewLens Price Scraper",
        "version": "2.0.0",
        "endpoints": {
            "/price/search": "Full pipeline — product name → SerpAPI URL → scrape price",
            "/price/from-url": "Scrape price from a direct Amazon/Flipkart URL",
            "/serpapi/urls": "Get product URLs from SerpAPI only (no scraping)",
        },
    }


@app.get("/price/search")
def search_and_scrape(
    product: str = Query(..., description="Product name e.g. 'Samsung Galaxy S24 128GB'"),
    platform: str = Query("both", description="Options: amazon | flipkart | both"),
):
    """
    Full pipeline:
    1. SerpAPI finds exact Amazon.in / Flipkart product URL for the given product name
    2. Scrapes the live price from that URL
    3. Returns comparison + cheaper platform
    """
    if not product.strip():
        raise HTTPException(status_code=400, detail="Product name cannot be empty")

    product = product.strip()
    response = {"query": product, "amazon": None, "flipkart": None, "comparison": None}

    # Amazon
    if platform in ("amazon", "both"):
        amz_search = serpapi_amazon_url(product)
        if amz_search.get("url"):
            scraped = scrape_amazon_price(amz_search["url"])
            # If SerpAPI already gave us price from shopping, use as fallback
            if not scraped.get("price") and amz_search.get("serpapi_price"):
                try:
                    raw = str(amz_search["serpapi_price"]).replace("₹", "").replace(",", "").strip()
                    scraped["price"] = int(float(raw))
                    scraped["price_source"] = "serpapi"
                except ValueError:
                    pass
            scraped["discount_percent"] = calc_discount(scraped.get("price"), scraped.get("mrp"))
            response["amazon"] = {**amz_search, **scraped}
        else:
            response["amazon"] = {"error": amz_search.get("error"), "url": None, "price": None}

    # Small delay between requests
    if platform == "both":
        time.sleep(0.8)

    # Flipkart
    if platform in ("flipkart", "both"):
        fk_search = serpapi_flipkart_url(product)
        if fk_search.get("url"):
            scraped = scrape_flipkart_price(fk_search["url"])
            scraped["discount_percent"] = calc_discount(scraped.get("price"), scraped.get("mrp"))
            response["flipkart"] = {**fk_search, **scraped}
        else:
            response["flipkart"] = {"error": fk_search.get("error"), "url": None, "price": None}

    # Price comparison
    amz_price = response["amazon"].get("price") if response["amazon"] else None
    fk_price  = response["flipkart"].get("price") if response["flipkart"] else None

    if amz_price and fk_price:
        cheaper = "amazon" if amz_price < fk_price else "flipkart"
        savings = abs(amz_price - fk_price)
        response["comparison"] = {
            "cheaper_on": cheaper,
            "amazon_price": amz_price,
            "flipkart_price": fk_price,
            "savings": savings,
            "savings_percent": round((savings / max(amz_price, fk_price)) * 100, 1),
        }
    elif amz_price:
        response["comparison"] = {"cheaper_on": "amazon", "amazon_price": amz_price, "flipkart_price": None}
    elif fk_price:
        response["comparison"] = {"cheaper_on": "flipkart", "flipkart_price": fk_price, "amazon_price": None}

    return response


@app.get("/price/from-url")
def scrape_from_url(
    url: str = Query(..., description="Direct Amazon.in or Flipkart product URL"),
):
    """
    Skip SerpAPI — scrape price directly from a given product URL.
    Useful when you already have the product link.
    """
    url = url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    if "amazon.in" in url:
        result = scrape_amazon_price(url)
    elif "flipkart.com" in url:
        result = scrape_flipkart_price(url)
    else:
        raise HTTPException(
            status_code=400,
            detail="Only amazon.in and flipkart.com URLs are supported",
        )

    result["discount_percent"] = calc_discount(result.get("price"), result.get("mrp"))
    return result


@app.get("/serpapi/urls")
def get_urls_only(
    product: str = Query(..., description="Product name to search"),
    platform: str = Query("both", description="Options: amazon | flipkart | both"),
):
    """
    Only run SerpAPI step — returns exact product URLs without scraping prices.
    Use this to preview which product page SerpAPI found before scraping.
    """
    if not product.strip():
        raise HTTPException(status_code=400, detail="Product name cannot be empty")

    product = product.strip()
    result = {}

    if platform in ("amazon", "both"):
        result["amazon"] = serpapi_amazon_url(product)

    if platform in ("flipkart", "both"):
        result["flipkart"] = serpapi_flipkart_url(product)

    return result


# ──────────────────────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("price_scraper:app", host="0.0.0.0", port=8001, reload=True)
