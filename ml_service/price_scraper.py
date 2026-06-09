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
# Robust Request Execution with Retries & Backoff
# ──────────────────────────────────────────────────────────────

def fetch_url_with_retry(session, url, retries=3, backoff_factor=1.0, timeout=12):
    """Fetches a URL with a retry mechanism and exponential backoff."""
    for i in range(retries):
        try:
            resp = session.get(url, timeout=timeout, allow_redirects=True)
            if resp.status_code == 429:
                # Rate limited, wait and retry
                time.sleep(backoff_factor * (2 ** i))
                continue
            return resp
        except requests.exceptions.RequestException as e:
            if i == retries - 1:
                raise e
            time.sleep(backoff_factor * (2 ** i))
    raise requests.exceptions.RequestException(f"Failed to fetch URL after {retries} retries")

# ──────────────────────────────────────────────────────────────
# Price and Currency Normalization Utility
# ──────────────────────────────────────────────────────────────

def normalize_price_inr(raw_value, currency_symbol="₹"):
    """
    Normalizes a scraped price value into INR.
    Converts foreign currencies (e.g. USD) to INR (1 USD = 83.5 INR).
    """
    if raw_value is None:
        return None, None, "INR"
    
    val = float(raw_value)
    if currency_symbol == "$" or currency_symbol.upper() == "USD":
        return int(round(val * 83.5)), val, "USD"
    
    # Heuristic: if price is very low for typical high-end electronics, assume it was scraped as USD
    # (e.g. an iPhone listed at 999 instead of 99900)
    if 0 < val < 2500 and currency_symbol != "₹":
        return int(round(val * 83.5)), val, "USD"
        
    return int(round(val)), val, "INR"

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
        resp = fetch_url_with_retry(session, url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        price = None
        currency_symbol = "₹"

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
                
            currency_meta = soup.find("meta", {"property": "product:price:currency"})
            if currency_meta and currency_meta.get("content"):
                currency_symbol = currency_meta["content"]

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
            raw_mrp = mrp_tag.get_text(strip=True).replace("₹", "").replace("$", "").replace(",", "").strip()
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

        # Normalize currency and price
        price_inr, price_original, currency = normalize_price_inr(price, currency_symbol)
        mrp_inr, _, _ = normalize_price_inr(mrp, currency_symbol)

        return {
            "platform": "amazon",
            "url": url,
            "title": title,
            "price": price_inr,  # Backward compatibility
            "price_inr": price_inr,
            "price_original": price_original,
            "currency": currency,
            "mrp": mrp_inr,
            "rating": rating,
            "symbol": "₹" if currency == "INR" else "$",
            "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    except requests.exceptions.HTTPError as e:
        return {
            "platform": "amazon",
            "url": url,
            "price": None,
            "error": f"HTTP {e.response.status_code} - Amazon blocked this request",
        }
    except Exception as e:
        return {"platform": "amazon", "url": url, "price": None, "error": str(e)}


def scrape_flipkart_price(url: str) -> dict:
    """Scrape price from Flipkart product page with multiple fallback selectors."""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        resp = fetch_url_with_retry(session, url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        price = None
        currency_symbol = "₹"

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

        price_inr, price_original, currency = normalize_price_inr(price, currency_symbol)
        mrp_inr, _, _ = normalize_price_inr(mrp, currency_symbol)

        return {
            "platform": "flipkart",
            "url": url,
            "title": title,
            "price": price_inr,  # Backward compatibility
            "price_inr": price_inr,
            "price_original": price_original,
            "currency": currency,
            "mrp": mrp_inr,
            "rating": rating,
            "symbol": "₹",
            "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
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
            
            # Strict validation: verify scraped or SerpAPI results have a valid title and price
            # Skip/reject if it's completely empty/garbage
            if not scraped.get("title") and amz_search.get("title"):
                scraped["title"] = amz_search["title"]

            # If SerpAPI already gave us price from shopping, use as fallback
            if not scraped.get("price_inr") and amz_search.get("serpapi_price"):
                try:
                    raw = str(amz_search["serpapi_price"]).replace("₹", "").replace("$", "").replace(",", "").strip()
                    val = float(raw)
                    # Infer symbol from string
                    sym = "$" if "$" in str(amz_search["serpapi_price"]) else "₹"
                    price_inr, price_original, currency = normalize_price_inr(val, sym)
                    scraped["price"] = price_inr
                    scraped["price_inr"] = price_inr
                    scraped["price_original"] = price_original
                    scraped["currency"] = currency
                    scraped["price_source"] = "serpapi"
                except ValueError:
                    pass

            # Strict validation check
            if not scraped.get("price_inr") or not scraped.get("title"):
                scraped["error"] = "Invalid scraped data: title or price missing"
                scraped["price_inr"] = None
                scraped["price"] = None

            scraped["discount_percent"] = calc_discount(scraped.get("price_inr"), scraped.get("mrp"))
            response["amazon"] = {**amz_search, **scraped}
        else:
            response["amazon"] = {"error": amz_search.get("error"), "url": None, "price": None, "price_inr": None}

    # Small delay between requests
    if platform == "both":
        time.sleep(0.8)

    # Flipkart
    if platform in ("flipkart", "both"):
        fk_search = serpapi_flipkart_url(product)
        if fk_search.get("url"):
            scraped = scrape_flipkart_price(fk_search["url"])
            
            if not scraped.get("title") and fk_search.get("title"):
                scraped["title"] = fk_search["title"]

            # Strict validation check
            if not scraped.get("price_inr") or not scraped.get("title"):
                scraped["error"] = "Invalid scraped data: title or price missing"
                scraped["price_inr"] = None
                scraped["price"] = None

            scraped["discount_percent"] = calc_discount(scraped.get("price_inr"), scraped.get("mrp"))
            response["flipkart"] = {**fk_search, **scraped}
        else:
            response["flipkart"] = {"error": fk_search.get("error"), "url": None, "price": None, "price_inr": None}

    # Price comparison
    amz_price = response["amazon"].get("price_inr") if (response["amazon"] and response["amazon"].get("price_inr")) else None
    fk_price  = response["flipkart"].get("price_inr") if (response["flipkart"] and response["flipkart"].get("price_inr")) else None

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

    # Strict validation
    if not result.get("price_inr") or not result.get("title"):
        raise HTTPException(
            status_code=422,
            detail="Could not scrape valid title or price from the provided URL"
        )

    result["discount_percent"] = calc_discount(result.get("price_inr"), result.get("mrp"))
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("price_scraper:app", host="0.0.0.0", port=8001, reload=True)
