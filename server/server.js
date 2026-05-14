const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

console.log("Loaded OpenAI key:", process.env.OPENAI_API_KEY ? "YES" : "NO");
console.log("Loaded NewsAPI key:", process.env.NEWS_API_KEY ? "YES" : "NO");

const app = express();
const PORT = 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const articleCache = {};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working" });
});

function getRecentDate(daysBack = 3) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

function buildNewsUrl(tab) {
  const apiKey = process.env.NEWS_API_KEY;
  const baseTop = "https://newsapi.org/v2/top-headlines";
  const baseEverything = "https://newsapi.org/v2/everything";
  const recentFrom = getRecentDate(3);

  switch (tab) {
    case "usa":
      return `${baseTop}?country=us&pageSize=15&apiKey=${apiKey}`;

    case "business":
      return `${baseTop}?country=us&category=business&pageSize=15&apiKey=${apiKey}`;

    case "tech":
      return `${baseTop}?country=us&category=technology&pageSize=15&apiKey=${apiKey}`;

    case "health":
      return `${baseTop}?country=us&category=health&pageSize=15&apiKey=${apiKey}`;

    case "sports":
      return `${baseTop}?country=us&category=sports&pageSize=15&apiKey=${apiKey}`;

    case "bahrain":
      return `${baseEverything}?q=("Bahrain" OR "Manama" OR "Bahraini") AND (Bahrain OR Manama OR Bahraini)&language=en&pageSize=15&sortBy=relevancy&from=${recentFrom}&searchIn=title,description&apiKey=${apiKey}`;

    case "iran":
      return `${baseEverything}?q=(Iran OR Tehran) AND (government OR conflict OR economy OR diplomacy OR protest OR nuclear)&language=en&pageSize=15&sortBy=relevancy&from=${recentFrom}&apiKey=${apiKey}`;

    case "gcc":
      return `${baseEverything}?q=(Bahrain OR Saudi Arabia OR UAE OR Qatar OR Kuwait OR Oman) AND (government OR economy OR diplomacy OR market OR conflict OR reform)&language=en&pageSize=15&sortBy=relevancy&from=${recentFrom}&apiKey=${apiKey}`;

    case "world":
      return `${baseEverything}?q=(world OR international OR global) AND (politics OR economy OR conflict OR diplomacy)&language=en&pageSize=15&sortBy=publishedAt&from=${recentFrom}&apiKey=${apiKey}`;

    case "other":
      return `${baseEverything}?q=(science OR environment OR education OR culture OR entertainment OR crime)&language=en&pageSize=15&sortBy=publishedAt&from=${recentFrom}&apiKey=${apiKey}`;

    case "all":
    default:
      return `${baseTop}?country=us&pageSize=15&apiKey=${apiKey}`;
  }
}

function buildSearchUrl(query) {
  const apiKey = process.env.NEWS_API_KEY;
  const baseEverything = "https://newsapi.org/v2/everything";
  const recentFrom = getRecentDate(10);

  return `${baseEverything}?q=${encodeURIComponent(query)}&language=en&pageSize=15&sortBy=publishedAt&from=${recentFrom}&searchIn=title,description&apiKey=${apiKey}`;
}

function buildFallbackSummary(article, language = "en") {
  const baseText =
    article.description ||
    article.content ||
    (language === "ar" ? "لا يوجد ملخص متاح." : "No summary available.");

  if (language === "ar") {
    return {
      summary: baseText,
      impactPoints: [
        "قد يؤثر هذا على تطور الوضع لاحقًا.",
        "يوفر هذا سياقًا مهمًا لفهم ما يجب متابعته.",
        "قد تكون للقصة آثار أوسع تستحق الانتباه."
      ]
    };
  }

  return {
    summary: baseText,
    impactPoints: [
      "This could affect how the situation develops next.",
      "It gives context for what people should keep an eye on.",
      "The story may matter because of its wider impact."
    ]
  };
}

function getLanguageInstruction(language = "en") {
  if (language === "ar") {
    return `
Write the summary and impactPoints in clear, natural Arabic.
Keep the tone readable, modern, and smooth.
Do not sound too formal or robotic.
Do not use emojis.
Do not use English unless it is part of a proper noun or unavoidable name.
`;
  }

  return `
Write the summary and impactPoints in clear, casual, easy-to-understand English that feels modern and Gen Z, but still factual and not cringe.
Do not use heavy slang.
Do not use emojis.
`;
}

async function generateSummaryAndImpact(article, language = "en") {
  const fallback = buildFallbackSummary(article, language);

  const inputText = `
Headline: ${article.title || "No headline"}
Source: ${article.source?.name || "Unknown source"}
Description: ${article.description || "No description available"}
Content: ${article.content || "No content available"}
Published: ${article.publishedAt || "Unknown date"}
`;

  try {
    console.log(`Summarizing article with AI in ${language}...`);

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      text: {
        format: { type: "json_object" }
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You are helping a news app called BeFrFr.

${getLanguageInstruction(language)}

Do not be biased.
Do not exaggerate.
Do not speculate.
Only use the information provided.
Do not add facts that were not given.

The summary should:
- be 5 to 6 sentences
- feel natural and readable
- stay neutral and informative

The "impactPoints" should:
- be an array of 3 short bullet points
- each bullet should be one sentence max
- explain why the story matters, what could be affected, or why people should care

Return JSON only with this exact shape:
{
  "summary": "5-6 sentence summary here",
  "impactPoints": [
    "First bullet point",
    "Second bullet point",
    "Third bullet point"
  ]
}`
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: inputText
            }
          ]
        }
      ]
    });

    const parsed = JSON.parse(response.output_text);

    console.log(`AI summary done in ${language}`);

    return {
      summary: parsed.summary || fallback.summary,
      impactPoints:
        Array.isArray(parsed.impactPoints) && parsed.impactPoints.length
          ? parsed.impactPoints.slice(0, 3)
          : fallback.impactPoints
    };
  } catch (error) {
    console.log(`AI failed in ${language}, using fallback summary`);
    return fallback;
  }
}

function normalizeArticle(item, categoryLabel, summaryData) {
  return {
    category: categoryLabel,
    title: item.title,
    source: item.source?.name || "Unknown source",
    publishedAt: item.publishedAt || null,
    url: item.url || "#",
    summary: summaryData.summary,
    impactPoints: summaryData.impactPoints
  };
}

function setupSSE(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

async function streamProcessedArticles(items, categoryLabel, language, res) {
  let sentCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.title || (!item.description && !item.content)) {
      console.log("Skipping broken article");
      continue;
    }

    const cacheKey = `${categoryLabel}::${language}::${item.url || item.title}`;
    let summaryData;

    if (articleCache[cacheKey]) {
      console.log(`Using cached ${language} summary for: ${item.title}`);
      summaryData = articleCache[cacheKey];
    } else {
      console.log(`Generating ${language} AI summary for: ${item.title}`);
      summaryData = await generateSummaryAndImpact(item, language);
      articleCache[cacheKey] = summaryData;
    }

    const article = normalizeArticle(item, categoryLabel, summaryData);

    res.write(`event: article\n`);
    res.write(`data: ${JSON.stringify(article)}\n\n`);

    sentCount += 1;

    if (sentCount === 15) break;
  }

  res.write(`event: done\n`);
  res.write(`data: ${JSON.stringify({ count: sentCount })}\n\n`);
  res.end();
}

app.get("/api/news/stream", async (req, res) => {
  setupSSE(res);

  try {
    const tab = (req.query.tab || "all").toLowerCase();
    const lang = (req.query.lang || "en").toLowerCase() === "ar" ? "ar" : "en";

    console.log(`\nStreaming ${tab} articles in ${lang}...`);

    const url = buildNewsUrl(tab);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`News API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.articles || !Array.isArray(data.articles)) {
      throw new Error("News API articles missing or invalid");
    }

    console.log(`Got ${data.articles.length} articles from the API`);
    await streamProcessedArticles(data.articles, tab, lang, res);
  } catch (error) {
    console.error("NEWS STREAM ERROR:", error.message);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: "Failed to fetch news" })}\n\n`);
    res.end();
  }
});

app.get("/api/search/stream", async (req, res) => {
  setupSSE(res);

  try {
    const query = (req.query.q || "").trim();
    const lang = (req.query.lang || "en").toLowerCase() === "ar" ? "ar" : "en";

    if (!query) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: "Search query is required" })}\n\n`);
      return res.end();
    }

    console.log(`\nStreaming search articles for: ${query} in ${lang}`);

    const url = buildSearchUrl(query);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`News API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.articles || !Array.isArray(data.articles)) {
      throw new Error("News API articles missing or invalid");
    }

    console.log(`Got ${data.articles.length} search articles from the API`);
    await streamProcessedArticles(data.articles, "search", lang, res);
  } catch (error) {
    console.error("SEARCH STREAM ERROR:", error.message);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: "Failed to search news" })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});