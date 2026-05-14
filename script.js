let articles = [];
let currentTab = "all";
let currentIndex = 0;
let currentSearchQuery = "";
let currentStream = null;
let isStreaming = false;
let currentLanguage = localStorage.getItem("befrfr_lang") || "en";
let currentTheme =
  localStorage.getItem("befrfr_theme") ||
  (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

const AVAILABLE_TOPICS = [
  "all",
  "bahrain",
  "iran",
  "world",
  "usa",
  "gcc",
  "business",
  "tech",
  "health",
  "sports",
  "other"
];

let selectedTopics = JSON.parse(localStorage.getItem("befrfr_topics")) || [];

const newsFeed = document.getElementById("news-feed");
const categoriesContainer = document.getElementById("categories");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");
const themeToggleInput = document.getElementById("theme-toggle-input");
const languageToggleInput = document.getElementById("language-toggle-input");
const interestsOverlay = document.getElementById("interests-overlay");
const interestButtons = document.querySelectorAll(".interest-btn");
const saveInterestsBtn = document.getElementById("save-interests-btn");
const editInterestsBtn = document.getElementById("edit-interests-btn");

function getUIText() {
  const isArabic = currentLanguage === "ar";

  return {
    loadingLatest: isArabic ? "جاري تحميل آخر الأخبار..." : "Loading latest stories...",
    searching: isArabic ? "جاري البحث عن المقالات..." : "Searching articles...",
    couldntLoad: isArabic ? "تعذر تحميل الأخبار الآن." : "Couldn’t load news right now.",
    couldntSearch: isArabic ? "تعذر البحث في الأخبار الآن." : "Couldn’t search news right now.",
    noStories: isArabic ? "لم يتم العثور على أخبار." : "No stories found.",
    noCategoryStories: isArabic ? "لا توجد أخبار في هذا التصنيف." : "No stories found for this category.",
    noSearchResults: isArabic
      ? `لم يتم العثور على مقالات عن "${currentSearchQuery}".`
      : `No articles found for "${currentSearchQuery}".`,
    unknownTime: isArabic ? "وقت غير معروف" : "Unknown time",
    justNow: isArabic ? "الآن" : "Just now",
    minAgo: isArabic ? "دقيقة" : "min ago",
    hrAgo: isArabic ? "ساعة" : "hr ago",
    dayAgo: isArabic ? "يوم" : "day ago",
    daysAgo: isArabic ? "أيام" : "days ago",
    weekAgo: isArabic ? "أسبوع" : "week ago",
    weeksAgo: isArabic ? "أسابيع" : "weeks ago",
    monthAgo: isArabic ? "شهر" : "month ago",
    monthsAgo: isArabic ? "أشهر" : "months ago",
    yearAgo: isArabic ? "سنة" : "year ago",
    yearsAgo: isArabic ? "سنوات" : "years ago",
    summary: isArabic ? "الملخص" : "Summary",
    whyThisMatters: isArabic ? "ليش هذا مهم" : "Why this matters",
    noImpact: isArabic ? "لا توجد ملاحظة متاحة." : "No impact note available.",
    readFull: isArabic ? "اقرأ الخبر كامل ←" : "Read full article →",
    tapNext: isArabic ? "اضغط للخبر التالي" : "Tap for next news",
    moreLoading: isArabic ? "المزيد من الأخبار قيد التحميل..." : "More news is loading...",
    loopNews: isArabic ? "اضغط لإعادة الأخبار" : "Tap to loop news",
    searchPlaceholder: isArabic ? "ابحث عن خبر..." : "Search for news...",
    editInterests: isArabic ? "تعديل الاهتمامات" : "Edit interests",
    pickInterestsTitle: isArabic ? "اختر اهتماماتك" : "Pick your interests",
    pickInterestsText: isArabic ? "اختر بعض المواضيع التي تريد رؤيتها في صفحتك." : "Choose a few topics you want to see in your feed.",
    showMyNews: isArabic ? "اعرض أخباري" : "Show my news",
    searchButton: isArabic ? "بحث" : "Search",
    tagline: isArabic ? "الأخبار، بدون اللف والدوران." : "The news, minus the nonsense."
  };
}

function updateStaticText() {
  const text = getUIText();

  const taglineEls = document.querySelectorAll(".tagline, .splash-tagline");
  taglineEls.forEach((el) => {
    el.textContent = text.tagline;
  });

  const editLabel = document.querySelector(".edit-label");
  if (editLabel) editLabel.textContent = text.editInterests;

  const overlayTitle = document.querySelector(".interests-box h2");
  if (overlayTitle) overlayTitle.textContent = text.pickInterestsTitle;

  const overlayText = document.querySelector(".interests-box p");
  if (overlayText) overlayText.textContent = text.pickInterestsText;

  if (saveInterestsBtn) saveInterestsBtn.textContent = text.showMyNews;

  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) searchBtn.textContent = text.searchButton;
}

function updateDocumentLanguage() {
  const isArabic = currentLanguage === "ar";
  document.documentElement.lang = isArabic ? "ar" : "en";
  document.body.classList.toggle("rtl", isArabic);
  searchInput.placeholder = getUIText().searchPlaceholder;
  updateStaticText();
  updateClearButtonVisibility();
}

function applyLanguageToggleState() {
  if (!languageToggleInput) return;
  languageToggleInput.checked = currentLanguage === "ar";
}

function ensureLanguageToggle() {
  if (!languageToggleInput) return;

  languageToggleInput.checked = currentLanguage === "ar";

  languageToggleInput.addEventListener("change", () => {
    currentLanguage = languageToggleInput.checked ? "ar" : "en";
    localStorage.setItem("befrfr_lang", currentLanguage);

    updateDocumentLanguage();
    applyLanguageToggleState();
    buildCategoryButtons();
    rerenderOrReloadContent();
  });
}

function applyTheme() {
  document.body.setAttribute("data-theme", currentTheme);
  if (themeToggleInput) {
    themeToggleInput.checked = currentTheme === "light";
  }
}

function ensureThemeToggle() {
  if (!themeToggleInput) return;

  themeToggleInput.checked = currentTheme === "light";

  themeToggleInput.addEventListener("change", () => {
    currentTheme = themeToggleInput.checked ? "light" : "dark";
    localStorage.setItem("befrfr_theme", currentTheme);
    applyTheme();
  });
}

function updateClearButtonVisibility() {
  if (!clearSearchBtn) return;
  clearSearchBtn.classList.toggle("hidden-clear", searchInput.value.trim() === "");
}

function rerenderOrReloadContent() {
  if (currentSearchQuery) {
    searchNews(currentSearchQuery);
    return;
  }

  if (selectedTopics.length) {
    fetchNews(currentTab || selectedTopics[0]);
    return;
  }

  if (articles.length) {
    renderCurrentArticle();
  }
}

function timeAgo(dateString) {
  const text = getUIText();

  if (!dateString) return text.unknownTime;

  const now = new Date();
  const published = new Date(dateString);
  const seconds = Math.floor((now - published) / 1000);

  if (seconds < 60) return text.justNow;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return currentLanguage === "ar"
      ? `منذ ${minutes} ${text.minAgo}`
      : `${minutes} ${text.minAgo}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return currentLanguage === "ar"
      ? `منذ ${hours} ${text.hrAgo}`
      : `${hours} ${text.hrAgo}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    if (currentLanguage === "ar") {
      return `منذ ${days} ${days > 1 ? text.daysAgo : text.dayAgo}`;
    }
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    if (currentLanguage === "ar") {
      return `منذ ${weeks} ${weeks > 1 ? text.weeksAgo : text.weekAgo}`;
    }
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    if (currentLanguage === "ar") {
      return `منذ ${months} ${months > 1 ? text.monthsAgo : text.monthAgo}`;
    }
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }

  const years = Math.floor(days / 365);
  if (currentLanguage === "ar") {
    return `منذ ${years} ${years > 1 ? text.yearsAgo : text.yearAgo}`;
  }
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

function renderImpactPoints(points) {
  const text = getUIText();

  if (!Array.isArray(points) || !points.length) {
    return `
      <ul class="impact-list">
        <li>${text.noImpact}</li>
      </ul>
    `;
  }

  return `
    <ul class="impact-list">
      ${points.map((point) => `<li>${point}</li>`).join("")}
    </ul>
  `;
}

function formatTopicLabel(topic) {
  if (currentLanguage === "ar") {
    const arabicLabels = {
      all: "الكل",
      bahrain: "البحرين",
      iran: "إيران",
      world: "العالم",
      usa: "أمريكا",
      gcc: "الخليج",
      business: "الأعمال",
      tech: "التقنية",
      health: "الصحة",
      sports: "الرياضة",
      other: "أخرى",
      search: "بحث",
      news: "خبر"
    };

    return arabicLabels[topic] || topic;
  }

  if (topic === "usa") return "USA";
  if (topic === "gcc") return "GCC";
  if (topic === "search") return "SEARCH";
  if (topic === "news") return "NEWS";
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function saveTopics() {
  localStorage.setItem("befrfr_topics", JSON.stringify(selectedTopics));
}

function openInterestsOverlay() {
  interestsOverlay.classList.remove("hidden");

  interestButtons.forEach((btn) => {
    const topic = btn.dataset.topic;
    btn.classList.toggle("active", selectedTopics.includes(topic));
    btn.textContent = formatTopicLabel(topic);
  });
}

function closeInterestsOverlay() {
  interestsOverlay.classList.add("hidden");
}

function buildCategoryButtons() {
  categoriesContainer.innerHTML = "";

  if (!selectedTopics.length) return;

  selectedTopics.forEach((topic, index) => {
    const button = document.createElement("button");
    const shouldBeActive =
      currentSearchQuery === "" &&
      ((currentTab && topic === currentTab) || (!currentTab && index === 0));

    button.className = `category-btn ${shouldBeActive ? "active" : ""}`;
    button.dataset.category = topic;
    button.textContent = formatTopicLabel(topic);

    button.addEventListener("click", () => {
      document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.classList.remove("active");
      });

      button.classList.add("active");
      fetchNews(topic);
    });

    categoriesContainer.appendChild(button);
  });
}

function closeCurrentStream() {
  if (currentStream) {
    currentStream.close();
    currentStream = null;
  }
}

function startLoadingState(message) {
  articles = [];
  currentIndex = 0;
  isStreaming = true;
  newsFeed.innerHTML = `<p class="empty-state">${message}</p>`;
}

function connectStream(url, loadingMessage, failedMessage, emptyType = "general") {
  closeCurrentStream();
  startLoadingState(loadingMessage);

  currentStream = new EventSource(url);

  currentStream.addEventListener("article", (event) => {
    try {
      const article = JSON.parse(event.data);
      articles.push(article);

      if (articles.length === 1) {
        renderCurrentArticle();
      }
    } catch (error) {
      console.error("Error parsing streamed article:", error);
    }
  });

  currentStream.addEventListener("done", () => {
    isStreaming = false;
    closeCurrentStream();

    if (!articles.length) {
      const text = getUIText();

      if (emptyType === "search") {
        newsFeed.innerHTML = `<p class="empty-state">${text.noSearchResults}</p>`;
      } else if (emptyType === "category") {
        newsFeed.innerHTML = `<p class="empty-state">${text.noCategoryStories}</p>`;
      } else {
        newsFeed.innerHTML = `<p class="empty-state">${text.noStories}</p>`;
      }
    } else {
      renderCurrentArticle();
    }
  });

  currentStream.addEventListener("error", (event) => {
    console.error("Stream error:", event);
    isStreaming = false;
    closeCurrentStream();

    if (!articles.length) {
      newsFeed.innerHTML = `<p class="empty-state">${failedMessage}</p>`;
    }
  });
}

function fetchNews(tab = "all") {
  currentTab = tab;
  currentIndex = 0;
  currentSearchQuery = "";

  const text = getUIText();

  connectStream(
    `/api/news/stream?tab=${encodeURIComponent(tab)}&lang=${encodeURIComponent(currentLanguage)}`,
    text.loadingLatest,
    text.couldntLoad,
    "category"
  );

  buildCategoryButtons();
}

function searchNews(query) {
  currentIndex = 0;
  currentSearchQuery = query;

  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const text = getUIText();

  connectStream(
    `/api/search/stream?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(currentLanguage)}`,
    text.searching,
    text.couldntSearch,
    "search"
  );
}

function renderCurrentArticle() {
  const text = getUIText();

  newsFeed.innerHTML = "";

  if (!articles.length) {
    newsFeed.innerHTML = `<p class="empty-state">${text.noStories}</p>`;
    return;
  }

  const article = articles[currentIndex];
  const hasNextLoaded = currentIndex < articles.length - 1;

  const card = document.createElement("article");
  card.classList.add("news-card", "single-card");
  card.setAttribute("dir", currentLanguage === "ar" ? "rtl" : "ltr");

  const categoryLabel = currentLanguage === "ar"
    ? formatTopicLabel(article.category || "news")
    : formatTopicLabel(article.category || "news").toUpperCase();

  card.innerHTML = `
    <div class="news-header">
      <span class="news-category">${categoryLabel}</span>
      <span class="news-source">${article.source || "Unknown source"}</span>
    </div>

    <p class="news-date">${timeAgo(article.publishedAt)}</p>

    <h2 class="news-title">${article.title || "Untitled article"}</h2>

    <div class="news-summary">
      <span class="label">${text.summary}</span>
      <p>${article.summary || text.noStories}</p>
    </div>

    <div class="news-impact">
      <span class="label">${text.whyThisMatters}</span>
      ${renderImpactPoints(article.impactPoints)}
    </div>

    <a class="news-link" href="${article.url || "#"}" target="_blank" rel="noopener noreferrer">
      ${text.readFull}
    </a>

    <div class="next-news-hint">
      ${
        hasNextLoaded
          ? text.tapNext
          : isStreaming
          ? text.moreLoading
          : text.loopNews
      }
    </div>
  `;

  card.addEventListener("click", (event) => {
    const clickedLink = event.target.closest(".news-link");
    if (clickedLink) return;

    showNextArticle();
  });

  newsFeed.appendChild(card);
}

function showNextArticle() {
  if (!articles.length) return;

  const hasNextLoaded = currentIndex < articles.length - 1;

  if (hasNextLoaded) {
    currentIndex += 1;
    renderCurrentArticle();
    return;
  }

  if (isStreaming) {
    return;
  }

  currentIndex = 0;
  renderCurrentArticle();
}

interestButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const topic = button.dataset.topic;

    if (selectedTopics.includes(topic)) {
      selectedTopics = selectedTopics.filter((item) => item !== topic);
      button.classList.remove("active");
    } else {
      selectedTopics.push(topic);
      button.classList.add("active");
    }
  });
});

saveInterestsBtn.addEventListener("click", () => {
  if (!selectedTopics.length) {
    selectedTopics = ["all"];
  }

  saveTopics();
  buildCategoryButtons();
  closeInterestsOverlay();
  currentTab = selectedTopics[0];
  fetchNews(selectedTopics[0]);
});

editInterestsBtn.addEventListener("click", () => {
  openInterestsOverlay();
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();
  if (!query) return;

  searchNews(query);
});

searchInput.addEventListener("input", () => {
  updateClearButtonVisibility();
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  currentSearchQuery = "";
  updateClearButtonVisibility();

  const firstTopic = selectedTopics[0] || "all";
  currentTab = firstTopic;
  fetchNews(firstTopic);
});

document.body.classList.add("splash-active");

window.addEventListener("beforeunload", () => {
  closeCurrentStream();
});

window.addEventListener("load", () => {
  applyTheme();
  applyLanguageToggleState();
  updateDocumentLanguage();
ensureLanguageToggle();
  ensureThemeToggle();
  updateStaticText();
  updateClearButtonVisibility();

  const splash = document.getElementById("splash-screen");

  setTimeout(() => {
    if (splash) {
      splash.classList.add("hide");
    }

    document.body.classList.remove("splash-active");
    document.body.classList.add("loaded");

    if (!selectedTopics.length) {
      openInterestsOverlay();
    } else {
      buildCategoryButtons();
      currentTab = selectedTopics[0];
      fetchNews(selectedTopics[0]);
    }
  }, 2200);
});