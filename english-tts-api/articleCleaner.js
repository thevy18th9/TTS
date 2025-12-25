const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const puppeteer = require('puppeteer');

/**
 * Article Cleaner Module
 * Trích xuất và làm sạch nội dung bài báo cho Text-to-Speech
 */

// User-Agent để tránh bị chặn bot
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 🔥 CLEANING FUNCTION - Làm sạch paragraphs khỏi noise keywords
 * @param {string[]} paragraphs - Mảng các đoạn văn
 * @returns {string[]} - Mảng các đoạn văn đã làm sạch
 */
function cleanParagraphs(paragraphs) {
  const noiseKeywords = [
    "đăng nhập",
    "tài khoản",
    "xác minh",
    "email",
    "quảng cáo",
    "advert",
    "cookie",
    "tin liên quan",
    "xem thêm",
    "bình luận",
    "bình chọn",
    "ứng dụng",
    "follow",
    "chính sách",
    "điều khoản",
    "trải nghiệm",
    "đăng ký"
  ];

  return paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 60)             // đoạn quá ngắn → bỏ
    .filter(p => !noiseKeywords.some(w => p.toLowerCase().includes(w)));  
}

// Từ khóa rác cần loại bỏ (mở rộng danh sách)
const JUNK_KEYWORDS = [
  'đăng nhập',
  'đăng ký',
  'quảng cáo',
  'banner',
  'bình luận',
  'chia sẻ',
  'tin liên quan',
  'đọc thêm',
  'xem thêm',
  'menu',
  'footer',
  'header',
  'sidebar',
  'widget',
  'cookie',
  'privacy',
  'terms',
  'subscribe',
  'newsletter',
  'follow us',
  'theo dõi',
  'like page',
  'fanpage',
  'social media',
  'tag:',
  'tags:',
  'category:',
  'chuyên mục:',
  'nguồn:',
  'source:',
  'tác giả:',
  'author:',
  'ngày đăng:',
  'published:',
  'cập nhật:',
  'updated:',
  'video:',
  'ảnh:',
  'hình ảnh:',
  'gallery:',
  'slideshow:',
  'advertisement',
  'sponsored',
  'tài trợ',
  'bài viết liên quan',
  'có thể bạn quan tâm',
  'tin nổi bật',
  'tin hot',
  'trending',
  'most read',
  'đọc nhiều nhất',
  // Từ khóa mới theo yêu cầu
  'tóm tắt tin',
  'ai',
  'thuật ngữ',
  'công cụ đầu tư',
  'chỉ số',
  'cổ phiếu',
  'liên quan',
  'related',
  'comment',
  'widget'
];

/**
 * Trích xuất nội dung chính từ URL bài báo
 * ✨ ĐẢM BẢO LUÔN RETURN ĐÚNG FORMAT {title, content} hoặc {title, content, error}
 * Sử dụng puppeteer-extra với StealthPlugin để tránh bị phát hiện bot
 * @param {string} url - URL của bài báo
 * @returns {Promise<{title: string, content: string} | {title: string, content: string, error: string}>}
 */
async function extractMainContent(url) {
  console.log("🚀 Starting extraction for:", url);

  const browser = await puppeteer.launch({
    // Headless chạy hoàn toàn ngầm, không mở cửa sổ / không chiếm focus
    headless: 'new',
    args: [
      '--headless=new',
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--disable-sync",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-pings",
      "--no-zygote",
      "--use-mock-keychain"
    ]
  });

  console.log("✅ Browser launched");

  const page = await browser.newPage();
  console.log("✅ Page created");

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  try {
    console.log("🌐 Navigating to:", url);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    console.log("✅ Page loaded successfully");

    // REPLACE waitForTimeout with safe delay
    await new Promise(r => setTimeout(r, 1500));

    const html = await page.content();
    console.log("📄 HTML LENGTH:", html.length);

    // Extract text using recursive DOM traversal
    const result = await page.evaluate(() => {
      // ⭐ Xóa popup/modal/login trước khi extract
      const junkSelectors = [
        ".popup", ".modal", ".login", ".auth", ".advert", 
        "[class*='popup']", "[class*='modal']", "[class*='login']",
        "[class*='advert']", "[class*='ads']", "[id*='popup']",
        "[id*='modal']", "[id*='login']", "[id*='advert']",
        "[class*='related']", "[class*='share']", "[class*='caption']",
        "[class*='photo']", "[class*='video']", "[class*='embed']",
        "[id*='related']", "[id*='share']", "[id*='caption']"
      ];
      
      junkSelectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(e => e.remove());
        } catch (e) {}
      });

      const title = document.querySelector("h1")?.innerText || "";

      // Find main content container
      const contentSelectors = [
        '.detail-content', '.content-detail', '.article-body',
        '.content-body', '.body-content', '.article', '.article-content',
        '.main-content', 'main', 'article', '[role="article"]'
      ];
      
      let contentContainer = document.body;
      for (const selector of contentSelectors) {
        const found = document.querySelector(selector);
        if (found) {
          contentContainer = found;
          break;
        }
      }

      // Media tags to skip (but continue traversal)
      const MEDIA_TAGS = ['IMG', 'FIGURE', 'FIGCAPTION', 'PICTURE', 'VIDEO', 
                         'IFRAME', 'SVG', 'CANVAS', 'AUDIO', 'SOURCE', 'TRACK'];
      
      // Non-content class/id patterns to skip
      const NON_CONTENT_PATTERNS = [
        /caption/i, /photo/i, /video/i, /embed/i, /ads/i, /advert/i,
        /related/i, /share/i, /popup/i, /login/i, /author/i, /sidebar/i,
        /widget/i, /comment/i, /social/i, /footer/i, /header/i, /nav/i,
        /menu/i, /banner/i, /sponsor/i, /promo/i
      ];

      // Recursive function to extract text, skipping media but continuing traversal
      function extractTextRecursive(node) {
        if (!node) return '';
        
        const nodeName = node.nodeName?.toUpperCase() || '';
        const className = node.className?.toString().toLowerCase() || '';
        const id = node.id?.toLowerCase() || '';
        
        // Skip media elements - return empty but traversal continues via parent
        if (MEDIA_TAGS.includes(nodeName)) {
          return '';
        }
        
        // Skip non-content blocks entirely
        const isNonContent = NON_CONTENT_PATTERNS.some(pattern => 
          pattern.test(className) || pattern.test(id)
        );
        
        if (isNonContent) {
          return '';
        }
        
        // For text nodes, return the text
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent?.trim() || '';
        }
        
        // For element nodes, recursively extract from children
        let text = '';
        if (node.childNodes && node.childNodes.length > 0) {
          for (const child of node.childNodes) {
            const childText = extractTextRecursive(child);
            if (childText) {
              text += (text ? ' ' : '') + childText;
            }
          }
        }
        
        return text.trim();
      }

      // Block-level elements that typically contain paragraphs
      const BLOCK_ELEMENTS = ['P', 'DIV', 'ARTICLE', 'SECTION', 'MAIN', 
                             'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'];
      
      // Extract paragraphs from block elements
      function extractParagraphsFromContainer(container) {
        const paragraphs = [];
        
        // Find all block elements that likely contain content
        const blockElements = Array.from(container.querySelectorAll(BLOCK_ELEMENTS.join(', ')))
          .filter(el => {
            const className = el.className?.toString().toLowerCase() || '';
            const id = el.id?.toLowerCase() || '';
            // Skip non-content blocks
            return !NON_CONTENT_PATTERNS.some(pattern => 
              pattern.test(className) || pattern.test(id)
            );
          });
        
        // Also include direct p elements if container itself is a block
        if (BLOCK_ELEMENTS.includes(container.nodeName?.toUpperCase() || '')) {
          blockElements.unshift(container);
        }
        
        // Extract text from each block element
        for (const block of blockElements) {
          // Skip if this block is inside a non-content parent
          let parent = block.parentElement;
          let shouldSkip = false;
          while (parent && parent !== container && parent !== document.body) {
            const parentClass = parent.className?.toString().toLowerCase() || '';
            const parentId = parent.id?.toLowerCase() || '';
            if (NON_CONTENT_PATTERNS.some(pattern => 
              pattern.test(parentClass) || pattern.test(parentId)
            )) {
              shouldSkip = true;
              break;
            }
            parent = parent.parentElement;
          }
          
          if (shouldSkip) continue;
          
          // Extract text recursively (this will skip media elements)
          const text = extractTextRecursive(block);
          
          if (text && text.length > 40) {
            paragraphs.push(text);
          }
        }
        
        return paragraphs;
      }

      // Extract paragraphs using recursive traversal
      let paragraphs = extractParagraphsFromContainer(contentContainer);
      
      // Fallback: if still no paragraphs, use direct p elements with recursive extraction
      if (paragraphs.length === 0) {
        const pElements = contentContainer.querySelectorAll('p');
        paragraphs = Array.from(pElements)
          .map(p => {
            // Use recursive extraction (automatically skips media)
            return extractTextRecursive(p);
          })
          .filter(text => text && text.length > 40);
      }
      
      // Additional fallback: extract from all divs with class containing "content"
      if (paragraphs.length === 0) {
        const contentDivs = contentContainer.querySelectorAll('div[class*="content"], div[class*="article"], div[class*="body"]');
        for (const div of contentDivs) {
          const text = extractTextRecursive(div);
          if (text && text.length > 40) {
            paragraphs.push(text);
          }
        }
      }
      
      // Final filter: only keep meaningful paragraphs (> 40 chars)
      paragraphs = paragraphs.filter(p => p && p.length > 40);
      
      // Remove duplicates and near-duplicates
      const uniqueParagraphs = [];
      const seen = new Set();
      for (const p of paragraphs) {
        const normalized = p.toLowerCase().trim().replace(/\s+/g, ' ');
        // Simple duplicate check (exact match)
        if (!seen.has(normalized) && normalized.length > 40) {
          seen.add(normalized);
          uniqueParagraphs.push(p);
        }
      }
      paragraphs = uniqueParagraphs;

      return {
        title,
        content: paragraphs.join("\n\n")
      };
    });

    // 🔥 Áp dụng cleaning function
    result.content = cleanParagraphs(result.content.split("\n")).join("\n");

    console.log("📌 TITLE FOUND:", result.title);
    console.log("📌 CONTENT LENGTH:", result.content.length);

    await browser.close();
    return result;

  } catch (err) {
    console.error("❌ Extractor error:", err);
    try {
      await browser.close();
    } catch (closeErr) {
      console.error("❌ Error closing browser:", closeErr);
    }
    return {
      title: "",
      content: "",
      error: String(err)
    };
  }
}

/**
 * Extract content from DOM document (helper function)
 * @param {Document} doc - DOM document
 * @param {string} url - URL for logging
 * @returns {Promise<{title: string, content: string} | null>}
 */
async function extractFromDOM(doc, url) {
  try {
    // 1️⃣ Lấy tiêu đề
    let title = '';
    const h1 = doc.querySelector('h1');
    if (h1) {
      title = h1.textContent?.trim() || '';
    }
    
    if (!title) {
      title = doc.querySelector('meta[property="og:title"]')?.content ||
              doc.querySelector('title')?.textContent || '';
    }

    // 2️⃣ Tìm content container
    const contentSelectors = [
      '.detail-content',
      '.content-detail',
      '.article-body',
      '.content-body',
      '.body-content',
      '.article',
      '.article-content',
      '.main-content',
      'main',
      'article'
    ];

    let contentContainer = null;
    for (const selector of contentSelectors) {
      try {
        const found = doc.querySelector(selector);
        if (found) {
          contentContainer = found;
          console.log(`✅ Found content container: ${selector}`);
          break;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    if (!contentContainer) {
      contentContainer = doc.body;
    }

    // Từ khóa SAPO tổng quát
    const sapoKeywords = [
      'tuyên bố', 'cho biết', 'mới đây', 'người hâm mộ', 'theo', 
      'cơ quan', 'vừa qua', 'theo thông tin', 'theo nguồn tin',
      'theo báo cáo', 'theo phóng viên', 'theo tác giả', 'theo chuyên gia'
    ];
    
    // Từ khóa rác
    const spamKeywords = [
      'đăng nhập', 'quảng cáo', 'tin liên quan', 'ai', 'thuật ngữ',
      'bình luận', 'xem thêm', 'video', 'clip', 'podcast',
      'chia sẻ', 'đọc thêm', 'tài trợ', 'sponsored'
    ];
    
    // 1️⃣ PHÁT HIỆN VÀ LOẠI BỎ SAPO
    const sapoSelectors = [
      '[class*="sapo"]', '[class*="summary"]', '[class*="lead"]', 
      '[class*="short-desc"]', '[id*="sapo"]', '[id*="summary"]'
    ];
    
    sapoSelectors.forEach(selector => {
      try {
        const elements = contentContainer.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      } catch (e) {}
    });
    
    // Loại bỏ h2/p/strong ngay dưới h1 nếu là SAPO
    if (h1 && contentContainer.contains(h1)) {
      let nextSibling = h1.nextElementSibling;
      for (let i = 0; i < 5 && nextSibling; i++) {
        const tagName = nextSibling.tagName?.toLowerCase();
        const className = nextSibling.className?.toLowerCase() || '';
        const text = nextSibling.textContent?.trim() || '';
        const lowerText = text.toLowerCase();
        
        // Kiểm tra nếu là SAPO
        const isSapoClass = className.includes('sapo') || className.includes('summary') || 
                           className.includes('lead') || className.includes('short-desc');
        const isSapoKeyword = text.length <= 180 && sapoKeywords.some(keyword => lowerText.includes(keyword));
        
        if (isSapoClass || (isSapoKeyword && (tagName === 'h2' || tagName === 'p' || tagName === 'strong'))) {
          nextSibling.remove();
          nextSibling = h1.nextElementSibling;
          continue;
        }
        
        nextSibling = nextSibling.nextElementSibling;
      }
    }
    
    // 2️⃣ LẤY CÁC ĐOẠN <p> THẬT SỰ
    const paragraphs = Array.from(contentContainer.querySelectorAll('p'))
      .map(p => {
        let parent = p.parentElement;
        while (parent && parent !== contentContainer && parent !== doc.body) {
          const parentClass = parent.className?.toLowerCase() || '';
          const parentId = parent.id?.toLowerCase() || '';
          if (parentClass.includes('sapo') || parentClass.includes('summary') ||
              parentId.includes('sapo') || parentId.includes('summary')) {
            return null;
          }
          parent = parent.parentElement;
        }
        return p.textContent?.trim() || '';
      })
      .filter(p => p !== null && p.length > 0);
    
    // 3️⃣ LẤY NỘI DUNG THẬT TỪ h2/strong (KHÔNG PHẢI TIÊU ĐỀ PHỤ)
    const h2StrongContent = Array.from(contentContainer.querySelectorAll('h2, strong'))
      .map(el => {
        const text = el.textContent?.trim() || '';
        const className = el.className?.toLowerCase() || '';
        const lowerText = text.toLowerCase();
        
        // Bỏ qua nếu có class sapo/summary
        if (className.includes('sapo') || className.includes('summary') || 
            className.includes('lead') || className.includes('short-desc')) {
          return null;
        }
        
        // Bỏ qua nếu là SAPO (gần h1 và chứa từ khóa SAPO)
        if (text.length <= 180 && sapoKeywords.some(keyword => lowerText.includes(keyword))) {
          // Kiểm tra xem có gần h1 không
          let prevSibling = el.previousElementSibling;
          let isNearH1 = false;
          for (let i = 0; i < 3 && prevSibling; i++) {
            if (prevSibling.tagName?.toLowerCase() === 'h1') {
              isNearH1 = true;
              break;
            }
            prevSibling = prevSibling.previousElementSibling;
          }
          if (isNearH1) return null;
        }
        
        // 3️⃣ NHẬN DIỆN TIÊU ĐỀ PHỤ (subheading) - LOẠI BỎ
        // Tiêu đề phụ: < 25 ký tự, không có dấu chấm, chỉ mô tả mục
        if (text.length < 25 && !text.includes('.')) {
          // Kiểm tra xem có phải mô tả mục không (ví dụ: "Tình hình chung", "Nguyên nhân")
          const subheadingPatterns = [
            'tình hình', 'nguyên nhân', 'diễn biến', 'kết quả', 'kết luận',
            'phần', 'mục', 'chương', 'điểm', 'khoản'
          ];
          if (subheadingPatterns.some(pattern => lowerText.includes(pattern))) {
            return null; // Đây là tiêu đề phụ, bỏ qua
          }
        }
        
        // 4️⃣ NHẬN DIỆN NỘI DUNG THẬT TRONG h2/strong - GIỮ LẠI
        // Nội dung thật: > 50 ký tự, không chứa từ khóa rác, không phải subheading ngắn
        // ✅ KHÔNG GIỚI HẠN ĐỘ DÀI - CHO PHÉP ĐỌC ĐẦY ĐỦ
        if (text.length > 50) {
          // Kiểm tra từ khóa rác
          const hasSpamKeyword = spamKeywords.some(keyword => lowerText.includes(keyword));
          if (!hasSpamKeyword) {
            // Không phải URL, email, số thuần - KHÔNG GIỚI HẠN ĐỘ DÀI
            if (!/^https?:\/\//.test(text) && !/^[\d\s\W]+$/.test(text)) {
              return text; // Đây là nội dung thật, giữ lại (không giới hạn độ dài)
            }
          }
        }
        
        return null;
      })
      .filter(text => text !== null && text.length > 0);
    
    // 5️⃣ KẾT HỢP <p> + h2/strong ĐƯỢC GIỮ LẠI
    const allContent = [...paragraphs, ...h2StrongContent]
      .filter(text => {
        // Chỉ giữ đoạn > 50 ký tự
        if (text.length <= 50) return false;
        
        // Loại bỏ spam keywords
        const lowerText = text.toLowerCase();
        if (spamKeywords.some(keyword => lowerText.includes(keyword))) {
          return false;
        }
        
        // Loại bỏ URL, email, số thuần
        if (/^https?:\/\//.test(text) || /^[\d\s\W]+$/.test(text)) {
          return false;
        }
        
        // ✅ KHÔNG GIỚI HẠN ĐỘ DÀI ĐOẠN - CHO PHÉP ĐỌC ĐẦY ĐỦ
        // (Đã loại bỏ filter text.length > 500)
        
        return true;
      });
    
    // ✅ KHÔNG GIỚI HẠN SỐ ĐOẠN - GIỮ LẠI TẤT CẢ ĐOẠN HỢP LỆ
    const mainParagraphs = allContent; // Giữ lại tất cả content
    let content = mainParagraphs.join('\n\n').trim();

    // 5️⃣ Fallback Readability
    if (!content || content.length < 100) {
      const reader = new Readability(doc);
      const article = reader.parse();
      if (article && article.textContent) {
        const cleanedReadability = cleanText(article.textContent);
        if (cleanedReadability && cleanedReadability.length >= 100) {
          content = cleanedReadability;
        }
      }
    }

    if (!content || content.length < 50) {
      return null;
    }

    return {
      title: title.trim(),
      content: content
    };

  } catch (error) {
    console.error(`❌ Error in extractFromDOM:`, error.message);
    return null;
  }
}

/**
 * Làm sạch văn bản, loại bỏ các phần rác
 * Loại bỏ tiêu đề phụ (h2, h3, strong) và các đoạn rác
 * @param {string} text - Văn bản cần làm sạch
 * @returns {string} - Văn bản đã làm sạch
 */
function cleanText(text) {
  if (!text) return '';

  // Chia thành các đoạn
  let paragraphs = text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Loại bỏ các đoạn rác
  paragraphs = paragraphs.filter(paragraph => {
    const lowerParagraph = paragraph.toLowerCase();
    
    // Bỏ đoạn quá ngắn (< 60 ký tự) - yêu cầu mới
    if (paragraph.length < 60) {
      return false;
    }

    // Bỏ đoạn chứa từ khóa rác
    const hasJunkKeyword = JUNK_KEYWORDS.some(keyword => 
      lowerParagraph.includes(keyword.toLowerCase())
    );
    
    if (hasJunkKeyword) {
      return false;
    }

    // Bỏ đoạn chỉ chứa số hoặc ký tự đặc biệt
    if (/^[\d\s\W]+$/.test(paragraph)) {
      return false;
    }

    // Bỏ đoạn chỉ chứa URL
    if (/^https?:\/\//.test(paragraph)) {
      return false;
    }

    // Bỏ đoạn chỉ chứa email
    if (/^[\w\.-]+@[\w\.-]+\.\w+$/.test(paragraph)) {
      return false;
    }

    // ✅ KHÔNG GIỚI HẠN ĐỘ DÀI ĐOẠN - CHO PHÉP ĐỌC ĐẦY ĐỦ
    // (Đã loại bỏ filter paragraph.length > 500)

    // Bỏ đoạn có vẻ là tiêu đề phụ (thường ngắn và có dấu đặc biệt)
    // Nếu đoạn < 100 ký tự và có nhiều dấu câu đặc biệt, có thể là tiêu đề
    if (paragraph.length < 100 && /[:\-–—]/.test(paragraph) && paragraph.split(/\s+/).length < 10) {
      return false;
    }

    return true;
  });

  // ✅ KHÔNG GIỚI HẠN SỐ ĐOẠN - GIỮ LẠI TẤT CẢ ĐOẠN HỢP LỆ
  const mainParagraphs = paragraphs; // Giữ lại tất cả paragraphs

  // Ghép lại thành văn bản (dùng \n\n để tách đoạn)
  let cleanedText = mainParagraphs.join('\n\n');

  // Loại bỏ khoảng trắng thừa trong mỗi đoạn
  cleanedText = cleanedText.replace(/[ \t]+/g, ' ').trim();

  // Loại bỏ các ký tự đặc biệt không cần thiết (giữ lại dấu câu tiếng Việt)
  cleanedText = cleanedText.replace(/[^\w\s.,!?;:()\-'"àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ]/g, ' ');

  // Loại bỏ khoảng trắng thừa sau khi clean
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  return cleanedText;
}

/**
 * Chuẩn bị văn bản cho Text-to-Speech
 * @param {Object} article - Object chứa title và content
 * @param {string} article.title - Tiêu đề bài báo
 * @param {string} article.content - Nội dung đã làm sạch
 * @returns {string} - Văn bản đã format cho TTS
 */
function prepareSpeechText(article) {
  const { title, content } = article;

  if (!title && !content) {
    return '';
  }

  // Format tiêu đề
  let speechText = '';
  if (title) {
    speechText += `Tin tức: ${title.trim()}. `;
  }

  // Format nội dung
  if (content) {
    speechText += `Nội dung chính: ${content.trim()}`;
  }

  // ✅ KHÔNG GIỚI HẠN ĐỘ DÀI - ĐỌC ĐẦY ĐỦ TẤT CẢ NỘI DUNG
  return speechText.trim();
}

/**
 * Hàm chính: Lấy nội dung bài báo đã làm sạch cho TTS
 * Loại bỏ hoàn toàn SAPO, chỉ lấy tiêu đề chính và nội dung chính
 * @param {string} url - URL của bài báo
 * @returns {Promise<{title: string, content: string, ttsText: string} | null>}
 */
async function getCleanArticleForTTS(url) {
  try {
    console.log(`🔍 getCleanArticleForTTS: Starting extraction for ${url}`);
    
    // Trích xuất nội dung chính (đã loại bỏ SAPO)
    const article = await extractMainContent(url);
    
    console.log(`📊 After extractMainContent:`);
    console.log(`   - Title: ${article?.title?.substring(0, 60)}...`);
    console.log(`   - Raw content length: ${article?.content?.length || 0} chars`);
    
    if (!article || !article.content) {
      console.warn('⚠️ Could not extract article content');
      return null;
    }

    // Làm sạch nội dung (loại bỏ thêm các phần rác)
    const cleaned = cleanText(article.content);
    
    console.log(`📊 After cleanText:`);
    console.log(`   - Cleaned content length: ${cleaned?.length || 0} chars`);
    console.log(`   - Content reduction: ${article.content.length} → ${cleaned?.length || 0} chars (${Math.round((1 - (cleaned?.length || 0) / article.content.length) * 100)}% removed)`);

    if (!cleaned || cleaned.length < 50) {
      console.warn('⚠️ Cleaned content too short or empty');
      return null;
    }

    // Chuẩn bị văn bản cho TTS
    const ttsText = prepareSpeechText({
      title: article.title,
      content: cleaned
    });

    console.log(`📊 After prepareSpeechText:`);
    console.log(`   - TTS text length: ${ttsText?.length || 0} chars`);
    console.log(`   - Preview: ${ttsText?.substring(0, 150)}...`);

    if (!ttsText || ttsText.length < 50) {
      console.warn('⚠️ Speech text too short or empty');
      return null;
    }

    const result = {
      title: article.title || 'Không có tiêu đề',
      content: cleaned,
      ttsText: ttsText,
      speechText: ttsText, // Alias for backward compatibility
      contentLength: ttsText.length
    };
    
    console.log(`✅ getCleanArticleForTTS: Successfully prepared article:`);
    console.log(`   - Title: ${result.title.substring(0, 60)}...`);
    console.log(`   - Content: ${result.content.length} chars`);
    console.log(`   - TTS Text: ${result.ttsText.length} chars`);
    console.log(`   - ✅ FULL CONTENT - NO LENGTH LIMIT`);

    return result;

  } catch (error) {
    console.error(`❌ Error in getCleanArticleForTTS:`, error.message);
    console.error(error.stack);
    return null;
  }
}

/**
 * Làm sạch nội dung từ text có sẵn (không cần fetch URL)
 * @param {string} title - Tiêu đề
 * @param {string} content - Nội dung thô
 * @returns {string} - Văn bản đã format cho TTS
 */
function cleanAndPrepareText(title, content) {
  const cleaned = cleanText(content);
  return prepareSpeechText({ title, content: cleaned });
}

module.exports = {
  getCleanArticleForTTS,
  extractMainContent,
  cleanText,
  prepareSpeechText,
  cleanAndPrepareText
};

