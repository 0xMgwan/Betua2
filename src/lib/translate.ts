/**
 * Translation service for auto-translating market content
 * Uses MyMemory Translation API (free, 10k words/day)
 */

const MYMEMORY_API = "https://api.mymemory.translated.net/get";

interface TranslationCache {
  [key: string]: string;
}

// In-memory cache to avoid repeated API calls
const translationCache: TranslationCache = {};

/**
 * Translate text from English to Swahili
 * @param text - Text to translate
 * @param fromLang - Source language (default: 'en')
 * @param toLang - Target language (default: 'sw')
 * @returns Translated text or original if translation fails
 */
export async function translateText(
  text: string,
  fromLang: string = "en",
  toLang: string = "sw"
): Promise<string> {
  if (!text || text.trim() === "") return text;
  
  // Return original if translating to same language
  if (fromLang === toLang) return text;

  // Check cache first
  const cacheKey = `${fromLang}-${toLang}-${text}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    // MyMemory API uses GET with query parameters
    const url = `${MYMEMORY_API}?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
    
    console.log(`[Translate] Calling API: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      console.error("[Translate] API error:", response.statusText);
      return text; // Return original on error
    }

    const data = await response.json();
    console.log(`[Translate] API response:`, data);
    
    const translated = data.responseData?.translatedText || text;
    console.log(`[Translate] Original: "${text.substring(0, 50)}..." -> Translated: "${translated.substring(0, 50)}..."`);

    // Cache the translation
    translationCache[cacheKey] = translated;

    return translated;
  } catch (error) {
    console.error("[Translate] Error:", error);
    return text; // Return original on error
  }
}

/**
 * Translate market content (title, description, options)
 */
export async function translateMarket(market: {
  title: string;
  description?: string;
  options?: string[];
}, toLang: string = "sw") {
  if (toLang === "en") {
    // No translation needed for English
    return market;
  }

  try {
    const [translatedTitle, translatedDescription, translatedOptions] = await Promise.all([
      translateText(market.title, "en", toLang),
      market.description ? translateText(market.description, "en", toLang) : Promise.resolve(undefined),
      market.options ? Promise.all(market.options.map(opt => translateText(opt, "en", toLang))) : Promise.resolve(undefined),
    ]);

    return {
      ...market,
      title: translatedTitle,
      description: translatedDescription,
      options: translatedOptions,
    };
  } catch (error) {
    console.error("Market translation error:", error);
    return market; // Return original on error
  }
}

/**
 * Clear translation cache (useful for testing or memory management)
 */
export function clearTranslationCache() {
  Object.keys(translationCache).forEach(key => delete translationCache[key]);
}
