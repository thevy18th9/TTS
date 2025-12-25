#!/usr/bin/env python3
"""
Debug RSS feeds to see why they're not working
"""

import feedparser
import requests

def test_rss_feed(url, name):
    """Test a single RSS feed"""
    print(f"\n🔍 Testing {name}: {url}")
    
    try:
        # Test with requests first
        response = requests.get(url, timeout=10)
        print(f"✅ HTTP Status: {response.status_code}")
        print(f"📄 Content length: {len(response.content)} bytes")
        print(f"📄 Content type: {response.headers.get('content-type', 'unknown')}")
        
        # Test with feedparser
        feed = feedparser.parse(url)
        print(f"📰 Feed title: {feed.feed.get('title', 'No title')}")
        print(f"📰 Feed description: {feed.feed.get('description', 'No description')}")
        print(f"📰 Number of entries: {len(feed.entries)}")
        
        if feed.entries:
            print(f"📰 First entry title: {feed.entries[0].get('title', 'No title')}")
            print(f"📰 First entry description: {feed.entries[0].get('description', 'No description')[:100]}...")
        else:
            print("❌ No entries found")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Test all RSS feeds"""
    print("🚀 Testing RSS Feeds...")
    
    feeds = [
        ("https://vnexpress.net/rss/tin-moi-nhat.rss", "VnExpress"),
        ("https://tuoitre.vn/rss/tin-moi-nhat.rss", "Tuổi Trẻ"),
        ("https://thanhnien.vn/rss/home.rss", "Thanh Niên"),
        ("https://dantri.com.vn/rss/tin-moi-nhat.rss", "Dân Trí"),
        ("https://vietnamnet.vn/rss/tin-moi-nhat.rss", "VietnamNet"),
        ("http://feeds.bbci.co.uk/news/rss.xml", "BBC"),
        ("http://rss.cnn.com/rss/edition.rss", "CNN"),
        ("https://feeds.reuters.com/reuters/topNews", "Reuters"),
        ("https://www.theguardian.com/world/rss", "The Guardian")
    ]
    
    for url, name in feeds:
        test_rss_feed(url, name)

if __name__ == "__main__":
    main()
