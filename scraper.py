import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re

USER_AGENTS = {
    "chrome": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "firefox": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "safari": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "mobile": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "bot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
}

def get_headers(ua_type="chrome"):
    ua = USER_AGENTS.get(ua_type, USER_AGENTS["chrome"])
    return {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }

def scrape_url(url: str, target: str = "all", selector: str = None, user_agent_type: str = "chrome", timeout: int = 15):
    """
    Scrapes the target URL and returns a structured dictionary of page details.
    """
    # Ensure URL has a scheme
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        headers = get_headers(user_agent_type)
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        response.raise_for_status()
    except requests.exceptions.MissingSchema:
        return {"error": "Invalid URL scheme. Please use http:// or https://."}
    except requests.exceptions.ConnectionError:
        return {"error": f"Failed to connect to {url}. The site might be down or blocked."}
    except requests.exceptions.Timeout:
        return {"error": f"Connection timed out while trying to reach {url}."}
    except requests.exceptions.HTTPError as e:
        return {"error": f"HTTP Error {response.status_code}: {response.reason}"}
    except Exception as e:
        return {"error": f"Error fetching URL: {str(e)}"}

    html_content = response.text
    try:
        soup = BeautifulSoup(html_content, "lxml")
    except Exception:
        # Fallback to standard parser if lxml fails
        soup = BeautifulSoup(html_content, "html.parser")

    domain = urlparse(url).netloc
    base_url = f"{urlparse(url).scheme}://{domain}"

    result = {
        "url": url,
        "status_code": response.status_code,
        "title": soup.title.string.strip() if soup.title else "No Title",
        "meta": {},
        "summary": {
            "links_count": 0,
            "images_count": 0,
            "tables_count": 0,
            "headings_count": 0
        }
    }

    # Extract Meta details
    for meta_tag in soup.find_all("meta"):
        name = meta_tag.get("name", "").lower()
        property_name = meta_tag.get("property", "").lower()
        content = meta_tag.get("content", "")
        
        if name:
            result["meta"][name] = content
        elif property_name:
            result["meta"][property_name] = content

    # Clean up empty keys
    result["meta"] = {k: v for k, v in result["meta"].items() if k and v}

    # Extract Page Summary Info
    # 1. Headings
    headings = {}
    for level in range(1, 7):
        tag_name = f"h{level}"
        tags = soup.find_all(tag_name)
        if tags:
            headings[tag_name] = [t.get_text(strip=True) for t in tags]
            result["summary"]["headings_count"] += len(tags)
    result["headings"] = headings

    # 2. Links
    links = []
    seen_links = set()
    for link_tag in soup.find_all("a", href=True):
        href = link_tag["href"]
        text = link_tag.get_text(strip=True) or "[No text or image]"
        
        # Resolve relative URLs
        full_url = urljoin(url, href)
        
        # Avoid duplicate links in the list
        if full_url not in seen_links:
            seen_links.add(full_url)
            parsed_href = urlparse(full_url)
            is_external = parsed_href.netloc != domain
            
            links.append({
                "text": text,
                "href": full_url,
                "is_external": is_external
            })
    
    result["links"] = links
    result["summary"]["links_count"] = len(links)

    # 3. Images
    images = []
    seen_images = set()
    for img_tag in soup.find_all("img", src=True):
        src = img_tag["src"]
        alt = img_tag.get("alt", "").strip() or img_tag.get("title", "").strip() or "No description"
        full_src = urljoin(url, src)
        
        if full_src not in seen_images:
            seen_images.add(full_src)
            images.append({
                "alt": alt,
                "src": full_src
            })
            
    result["images"] = images
    result["summary"]["images_count"] = len(images)

    # 4. Tables
    tables = []
    for i, table_tag in enumerate(soup.find_all("table")):
        table_data = {"id": i + 1, "headers": [], "rows": []}
        
        # Find headers
        headers = table_tag.find_all("th")
        if headers:
            table_data["headers"] = [th.get_text(strip=True) for th in headers]
        
        # Find rows
        rows = table_tag.find_all("tr")
        for row in rows:
            cols = row.find_all("td")
            if cols:
                row_cells = [td.get_text(strip=True) for td in cols]
                # If there were no explicit <th> tags, check if first row serves as headers
                if not table_data["headers"] and len(table_data["rows"]) == 0:
                    table_data["headers"] = row_cells
                else:
                    table_data["rows"].append(row_cells)
        
        if table_data["headers"] or table_data["rows"]:
            # Ensure headers match the width of the row cells
            max_cols = max([len(r) for r in table_data["rows"]] + [len(table_data["headers"])])
            if not table_data["headers"]:
                table_data["headers"] = [f"Column {j+1}" for j in range(max_cols)]
            while len(table_data["headers"]) < max_cols:
                table_data["headers"].append(f"Column {len(table_data['headers'])+1}")
                
            tables.append(table_data)

    result["tables"] = tables
    result["summary"]["tables_count"] = len(tables)

    # 5. Raw HTML representation (truncated for performance, full code will be served on requests)
    result["raw_html"] = html_content[:50000] + "\n... [TRUNCATED FOR PREVIEW] ..." if len(html_content) > 50000 else html_content

    # 6. Custom CSS selector extraction
    result["custom_selector"] = {
        "selector": selector,
        "count": 0,
        "matches": []
    }
    if selector:
        try:
            matches = soup.select(selector)
            result["custom_selector"]["count"] = len(matches)
            for item in matches:
                # Text content
                text = item.get_text(strip=True)
                # Outer html (truncated if too long)
                outer = str(item)
                if len(outer) > 2000:
                    outer = outer[:2000] + "... [TRUNCATED] ..."
                # Tag name
                tag_name = item.name
                # Attributes
                attrs = {k: v for k, v in item.attrs.items()}
                
                result["custom_selector"]["matches"].append({
                    "tag": tag_name,
                    "text": text,
                    "outer_html": outer,
                    "attributes": attrs
                })
        except Exception as e:
            result["custom_selector"]["error"] = f"Invalid selector or parsing error: {str(e)}"

    return result
