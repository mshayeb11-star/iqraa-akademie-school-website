let iqraaImageData = null;
let pageTransitionActive = false;
let pageReadyTimer = null;
let pageReentryTimer = null;
let revealObserver = null;

function getPageLoader() {
  return document.getElementById("pageLoader");
}

function setPageLoadedState(isLoaded) {
  if (!document.body) return;
  document.body.classList.toggle("loaded", isLoaded);
}

function showPageLoader() {
  const loader = getPageLoader();

  if (loader) {
    loader.setAttribute("aria-hidden", "false");
  }

  setPageLoadedState(false);
}

function hidePageLoaderImmediate() {
  if (pageReadyTimer) {
    clearTimeout(pageReadyTimer);
    pageReadyTimer = null;
  }

  const loader = getPageLoader();

  if (loader) {
    loader.setAttribute("aria-hidden", "true");
  }

  setPageLoadedState(true);
}

function schedulePageReady(delay = 0) {
  if (pageReadyTimer) {
    clearTimeout(pageReadyTimer);
  }

  pageReadyTimer = window.setTimeout(() => {
    hidePageLoaderImmediate();
  }, Math.max(0, delay));
}

function triggerPageReentryAnimation() {
  if (!document.body) return;

  if (pageReentryTimer) {
    clearTimeout(pageReentryTimer);
  }

  document.body.classList.remove("page-reenter");
  void document.body.offsetWidth;
  document.body.classList.add("page-reenter");

  pageReentryTimer = window.setTimeout(() => {
    document.body.classList.remove("page-reenter");
  }, 520);
}

function forceHideOverlay(overlay) {
  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.classList.remove("is-opening", "is-open", "is-closing", "is-hiding");
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.active = "false";
}

function restorePageAfterHistoryNavigation() {
  pageTransitionActive = false;

  forceHideOverlay(document.getElementById("mediaIntroOverlay"));
  forceHideOverlay(document.getElementById("reviewsIntroOverlay"));

  if (document.body) {
    document.body.classList.remove("reviews-intro-lock");
  }

  hidePageLoaderImmediate();
  triggerPageReentryAnimation();
}

function isHistoryNavigation(event) {
  const navigationEntry = performance.getEntriesByType("navigation")[0];
  return Boolean(event?.persisted) || navigationEntry?.type === "back_forward";
}

async function loadImages() {
  try {
    const isFileProtocol = window.location.protocol === "file:";

    if (isFileProtocol) {
      return;
    }

    const assetVersion = "20260328-v1";

    const res = await fetch(`/data/images.json?v=${assetVersion}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to load images.json: ${res.status}`);
    }

    const data = await res.json();
    iqraaImageData = data;

    function render(containerId, images, options = {}) {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(images)) return;

      const { limit = null } = options;
      const safeImages = images.filter(Boolean);
      const finalImages =
        typeof limit === "number" && limit > 0
          ? safeImages.slice(0, limit)
          : safeImages;

      const fragment = document.createDocumentFragment();
      container.innerHTML = "";

      finalImages.forEach((src, index) => {
        const card = document.createElement("article");
        card.className = "media-card reveal";
        card.style.setProperty("--stagger-delay", `${index * 0.07}s`);
        card.style.setProperty("--float-delay", `${index * 0.4}s`);
        card.setAttribute("tabindex", "0");

        const img = document.createElement("img");
        img.src = `${src}?v=${assetVersion}`;
        img.loading = index < 3 ? "eager" : "lazy";
        img.decoding = "async";
        img.alt = "Iqraa Akademie";
        img.draggable = false;

        img.onerror = () => {
          console.error("Failed image:", img.src);
          card.remove();
        };

        card.appendChild(img);
        fragment.appendChild(card);
      });

      container.appendChild(fragment);

      protectMediaElements(container.querySelectorAll("img, video"));
    }

    function populateReviewsIntroCards(images) {
      const introCards = document.querySelectorAll(".reviews-fan-card");
      if (!introCards.length) return Promise.resolve();

      const loadingPromises = [];

      introCards.forEach((card, index) => {
        card.innerHTML = "";
        card.classList.add("is-empty");

        if (!Array.isArray(images) || !images[index]) {
          return;
        }

        const img = document.createElement("img");
        img.src = `${images[index]}?v=${assetVersion}`;
        img.loading = "eager";
        img.decoding = "async";
        img.alt = "Iqraa Akademie Bewertung";
        img.draggable = false;

        const imageReadyPromise = new Promise((resolve) => {
          img.onload = () => {
            card.classList.remove("is-empty");
            resolve(true);
          };

          img.onerror = () => {
            card.innerHTML = "";
            card.classList.add("is-empty");
            resolve(false);
          };
        });

        loadingPromises.push(imageReadyPromise);
        card.appendChild(img);
      });

      protectMediaElements(document.querySelectorAll(".reviews-fan-card img"));

      return Promise.all(loadingPromises);
    }

    render("galleryGrid", data.gallery);
    render("heroKidsGrid", data.hero);
    render("certificateGrid", data.certificates);

    render("galleryPageGrid", data.gallery);
    render("heroMomentsPageGrid", data.hero);
    render("certificatePageGrid", data.certificates);

    render("reviewGrid", data.reviews);

    await populateReviewsIntroCards(
      Array.isArray(data.reviews) ? data.reviews.slice(0, 3) : []
    );

    initReveal();
    initInteractiveMediaRails();
    initMediaIntroLinks();
  } catch (error) {
    console.error("Image loading error:", error);
  }
}

function initReveal() {
  const revealItems = document.querySelectorAll(".reveal");

  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("in-view"));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

function initInteractiveMediaRails() {
  const rails = document.querySelectorAll('[data-live-preview="true"]');

  rails.forEach((grid) => {
    if (grid.dataset.railInitialized === "true") return;
    grid.dataset.railInitialized = "true";

    const railWrap = grid.closest(".cinematic-rail");
    const cards = Array.from(grid.querySelectorAll(".media-card"));
    if (cards.length < 2) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    grid.classList.add("is-interactive-rail");

    let scrollTicking = false;
    let resizeTimer = null;
    let activeIndex = 0;

    function getCardCenter(card) {
      return card.offsetLeft + card.offsetWidth / 2;
    }

    function getViewportCenter() {
      return grid.scrollLeft + grid.clientWidth / 2;
    }

    function getClosestCardIndex() {
      const viewportCenter = getViewportCenter();
      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const distance = Math.abs(getCardCenter(card) - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    }

    function updateArrowState() {
      if (!railWrap) return;

      const leftButton = railWrap.querySelector('.media-rail-arrow[data-rail-direction="-1"]');
      const rightButton = railWrap.querySelector('.media-rail-arrow[data-rail-direction="1"]');

      if (leftButton) {
        leftButton.disabled = activeIndex <= 0;
        leftButton.classList.toggle("is-disabled", activeIndex <= 0);
      }

      if (rightButton) {
        rightButton.disabled = activeIndex >= cards.length - 1;
        rightButton.classList.toggle("is-disabled", activeIndex >= cards.length - 1);
      }
    }

    function updateActiveCards() {
      activeIndex = getClosestCardIndex();

      cards.forEach((card, index) => {
        card.classList.remove(
          "is-active",
          "is-side",
          "is-far",
          "is-before-spotlight",
          "is-after-spotlight",
          "is-spotlight"
        );

        const distance = Math.abs(index - activeIndex);

        if (index === activeIndex) {
          card.classList.add("is-active", "is-spotlight");
        } else if (distance === 1) {
          card.classList.add("is-side");
          if (index < activeIndex) {
            card.classList.add("is-before-spotlight");
          } else {
            card.classList.add("is-after-spotlight");
          }
        } else {
          card.classList.add("is-far");
        }
      });

      updateArrowState();
    }

    function centerCard(index, behavior = "smooth") {
      const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
      const card = cards[safeIndex];
      if (!card) return;

      const targetLeft =
        card.offsetLeft - (grid.clientWidth / 2 - card.offsetWidth / 2);

      grid.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: prefersReducedMotion ? "auto" : behavior,
      });

      if (prefersReducedMotion || behavior === "auto") {
        activeIndex = safeIndex;
        updateActiveCards();
      }
    }

    function setupInitialPosition() {
      const startIndex = cards.length > 2 ? 1 : 0;
      centerCard(startIndex, "auto");
      updateActiveCards();
    }

    function handleScroll() {
      if (scrollTicking) return;

      scrollTicking = true;
      requestAnimationFrame(() => {
        updateActiveCards();
        scrollTicking = false;
      });
    }

    function handleWheel(event) {
      const isDesktop = window.innerWidth > 900;
      if (!isDesktop) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      if (absY > absX) {
        event.preventDefault();
        grid.scrollBy({
          left: event.deltaY * 1.1,
          behavior: "auto",
        });
      }
    }

    function bindArrowControls() {
      if (!railWrap) return;

      const arrowButtons = railWrap.querySelectorAll(".media-rail-arrow");
      arrowButtons.forEach((button) => {
        if (button.dataset.railArrowBound === "true") return;
        button.dataset.railArrowBound = "true";

        button.addEventListener("click", () => {
          const direction = Number(button.dataset.railDirection || "0");
          centerCard(activeIndex + direction);
        });
      });
    }

    cards.forEach((card, index) => {
      card.addEventListener("click", () => {
        centerCard(index);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          centerCard(index);
        }
      });
    });

    grid.addEventListener("scroll", handleScroll, { passive: true });
    grid.addEventListener("wheel", handleWheel, { passive: false });

    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        updateInteractiveRailLayout(grid, cards);
        centerCard(activeIndex, "auto");
        updateActiveCards();
      }, 160);
    });

    updateInteractiveRailLayout(grid, cards);
    bindArrowControls();
    setupInitialPosition();
  });
}

function updateInteractiveRailLayout(grid, cards) {
  const isMobile = window.innerWidth <= 900;

  grid.style.display = "flex";
  grid.style.flexWrap = "nowrap";
  grid.style.alignItems = "center";
  grid.style.justifyContent = "flex-start";
  grid.style.overflowX = "auto";
  grid.style.overflowY = "visible";
  grid.style.scrollSnapType = "x mandatory";
  grid.style.webkitOverflowScrolling = "touch";
  grid.style.scrollBehavior = "smooth";
  grid.style.paddingBottom = "8px";

  if (isMobile) {
    grid.style.gap = "14px";
    grid.style.paddingLeft = "16px";
    grid.style.paddingRight = "16px";
  } else {
    grid.style.gap = "18px";
    grid.style.paddingLeft = "40px";
    grid.style.paddingRight = "40px";
  }

  cards.forEach((card) => {
    card.style.flex = "0 0 auto";
    card.style.scrollSnapAlign = "center";
    card.style.cursor = "pointer";
  });
}

function getIntroImagesByKey(key) {
  if (!iqraaImageData) return [];

  if (key === "gallery") {
    return Array.isArray(iqraaImageData.gallery) ? iqraaImageData.gallery : [];
  }

  if (key === "hero") {
    return Array.isArray(iqraaImageData.hero) ? iqraaImageData.hero : [];
  }

  if (key === "certificates") {
    return Array.isArray(iqraaImageData.certificates)
      ? iqraaImageData.certificates
      : [];
  }

  if (key === "reviews") {
    return Array.isArray(iqraaImageData.reviews) ? iqraaImageData.reviews : [];
  }

  return [];
}

function ensureMediaIntroOverlay() {
  let overlay = document.getElementById("mediaIntroOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "mediaIntroOverlay";
  overlay.className = "reviews-intro-overlay media-intro-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="reviews-intro-stage media-intro-stage">
      <div class="reviews-intro-glow reviews-intro-glow-a"></div>
      <div class="reviews-intro-glow reviews-intro-glow-b"></div>
      <div class="reviews-intro-center">
        <img src="logo.png" alt="Iqraa Akademie Logo" class="reviews-intro-logo">
        <div class="reviews-intro-badge">Iqraa Akademie / أكاديمية اقرأ</div>
        <div class="reviews-intro-fan media-intro-fan">
          <div class="reviews-fan-card reviews-fan-card-1 is-empty"></div>
          <div class="reviews-fan-card reviews-fan-card-2 is-empty"></div>
          <div class="reviews-fan-card reviews-fan-card-3 is-empty"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function populateMediaIntroCards(images) {
  const overlay = ensureMediaIntroOverlay();
  const cards = overlay.querySelectorAll(".reviews-fan-card");
  const assetVersion = "20260328-v1";
  const selectedImages = Array.isArray(images) ? images.filter(Boolean).slice(0, 3) : [];

  const loadingPromises = [];

  cards.forEach((card, index) => {
    card.innerHTML = "";
    card.classList.add("is-empty");

    if (!selectedImages[index]) return;

    const img = document.createElement("img");
    img.src = `${selectedImages[index]}?v=${assetVersion}`;
    img.loading = "eager";
    img.decoding = "async";
    img.alt = "Iqraa Akademie Galerie";
    img.draggable = false;

    const imageReadyPromise = new Promise((resolve) => {
      img.onload = () => {
        card.classList.remove("is-empty");
        resolve(true);
      };

      img.onerror = () => {
        card.innerHTML = "";
        card.classList.add("is-empty");
        resolve(false);
      };
    });

    loadingPromises.push(imageReadyPromise);
    card.appendChild(img);
  });

  protectMediaElements(overlay.querySelectorAll("img"));
  return Promise.all(loadingPromises);
}

function runMediaIntroAndNavigate(url, imageKey) {
  const overlay = ensureMediaIntroOverlay();
  const chosenImages = getIntroImagesByKey(imageKey);
  const openDuration = 620;
  const holdDuration = 360;
  const closeDuration = 420;

  populateMediaIntroCards(chosenImages).finally(() => {
    overlay.classList.remove("hidden", "is-opening", "is-open", "is-closing", "is-hiding");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("reviews-intro-lock");
    void overlay.offsetWidth;
    overlay.classList.add("is-opening");

    window.setTimeout(() => {
      overlay.classList.remove("is-opening");
      overlay.classList.add("is-open");

      window.setTimeout(() => {
        overlay.classList.remove("is-open");
        overlay.classList.add("is-closing");

        window.setTimeout(() => {
          window.location.href = url;
        }, closeDuration);
      }, holdDuration);
    }, openDuration);
  });
}

function initMediaIntroLinks() {
  const links = document.querySelectorAll(".media-intro-link");
  if (!links.length) return;

  links.forEach((link) => {
    if (link.dataset.mediaIntroBound === "true") return;
    link.dataset.mediaIntroBound = "true";

    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      const imageKey = link.dataset.introImages || "gallery";

      if (!href) return;
      event.preventDefault();
      runMediaIntroAndNavigate(href, imageKey);
    });
  });
}

function setupSignaturePad(canvasId, hiddenInputId) {
  const canvas = document.getElementById(canvasId);
  const hiddenInput = document.getElementById(hiddenInputId);

  if (!canvas || !hiddenInput) return null;

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let hasSigned = false;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const oldData = hasSigned ? canvas.toDataURL("image/png") : null;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);

    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f2b3a";

    if (oldData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = oldData;
    }
  }

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const isTouch = event.touches && event.touches[0];
    const clientX = isTouch ? event.touches[0].clientX : event.clientX;
    const clientY = isTouch ? event.touches[0].clientY : event.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDrawing(event) {
    drawing = true;
    hasSigned = true;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    event.preventDefault();
  }

  function draw(event) {
    if (!drawing) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    event.preventDefault();
  }

  function stopDrawing() {
    if (!drawing) return;
    drawing = false;
    hiddenInput.value = canvas.toDataURL("image/png");
  }

  function clearSignature() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hiddenInput.value = "";
    hasSigned = false;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);

  canvas.addEventListener("touchstart", startDrawing, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDrawing);
  canvas.addEventListener("touchcancel", stopDrawing);

  return {
    clearSignature,
    hiddenInput,
  };
}

function setupConditionalField(radioName, wrapId, inputId) {
  const radios = document.querySelectorAll(`input[name="${radioName}"]`);
  const wrap = document.getElementById(wrapId);
  const input = document.getElementById(inputId);

  if (!radios.length || !wrap || !input) return;

  function update() {
    const checked = document.querySelector(`input[name="${radioName}"]:checked`);
    const show = checked && checked.value === "نعم";

    wrap.classList.toggle("hidden", !show);
    input.disabled = !show;
    input.required = !!show;

    if (!show) {
      input.value = "";
    }
  }

  radios.forEach((radio) => {
    radio.addEventListener("change", update);
  });

  update();
}

function getFormDataObject(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    data[key] = typeof value === "string" ? value.trim() : value;
  }

  return data;
}

function getSendingOverlayElements() {
  const overlay = document.getElementById("sendingOverlay");
  if (!overlay) return null;

  const title = overlay.querySelector("h3");
  const paragraphs = overlay.querySelectorAll("p");

  return {
    overlay,
    title,
    deText: paragraphs[0] || null,
    arText: paragraphs[1] || null,
  };
}

function setSendingOverlayVisible(visible) {
  const elements = getSendingOverlayElements();
  if (!elements) return;

  elements.overlay.classList.toggle("hidden", !visible);
  elements.overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  document.body.classList.toggle("sending-active", visible);
}

function setSendingOverlayText({
  title = "Ihre Anmeldung wird gesendet",
  deText = "Bitte einen Moment warten...",
  arText = "يتم الآن إرسال استمارة التسجيل، يرجى الانتظار قليلاً...",
} = {}) {
  const elements = getSendingOverlayElements();
  if (!elements) return;

  if (elements.title) {
    elements.title.textContent = title;
  }

  if (elements.deText) {
    elements.deText.textContent = deText;
    elements.deText.classList.add("sending-progress-dots");
  }

  if (elements.arText) {
    elements.arText.textContent = arText;
    elements.arText.classList.remove("sending-progress-dots");
  }
}

function resetSendingOverlayText() {
  setSendingOverlayText({
    title: "Ihre Anmeldung wird gesendet",
    deText: "Bitte einen Moment warten...",
    arText: "يتم الآن إرسال استمارة التسجيل، يرجى الانتظار قليلاً...",
  });
}

const sendingMessageSteps = [
  {
    title: "Ihre Anmeldung wird gesendet",
    deText: "Anmeldung wird vorbereitet",
    arText: "يتم تجهيز التسجيل",
  },
  {
    title: "Ihre Anmeldung wird gesendet",
    deText: "Ihre Daten werden verarbeitet",
    arText: "يتم الآن معالجة البيانات",
  },
  {
    title: "Ihre Anmeldung wird gesendet",
    deText: "Bestätigung wird gesendet",
    arText: "يتم إرسال التأكيد",
  },
  {
    title: "Ihre Anmeldung wird gesendet",
    deText: "Fast fertig",
    arText: "أوشكنا على الانتهاء",
  },
];

let sendingMessageInterval = null;

function startSendingOverlaySequence() {
  stopSendingOverlaySequence();

  let index = 0;
  setSendingOverlayText(sendingMessageSteps[index]);

  sendingMessageInterval = window.setInterval(() => {
    index = (index + 1) % sendingMessageSteps.length;
    setSendingOverlayText(sendingMessageSteps[index]);
  }, 1700);
}

function stopSendingOverlaySequence() {
  if (sendingMessageInterval) {
    clearInterval(sendingMessageInterval);
    sendingMessageInterval = null;
  }
}

function setSubmitButtonLoading(button, isLoading) {
  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = isLoading;
  button.setAttribute("aria-busy", isLoading ? "true" : "false");
  button.classList.toggle("is-loading", isLoading);

  if (isLoading) {
    button.textContent = "Wird gesendet... / جاري الإرسال...";
  } else {
    button.textContent = button.dataset.originalText;
  }
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setupSignaturePads() {
  const guardianPad = setupSignaturePad("guardianSignaturePad", "guardianSignatureData");

  document.querySelectorAll(".signature-clear-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-target");

      if (target === "guardianSignaturePad" && guardianPad) {
        guardianPad.clearSignature();
      }
    });
  });

  const form = document.getElementById("registrationForm");
  const formMessage = document.getElementById("formMessage");
  const submitButton = form?.querySelector('button[type="submit"]');

  if (!form || !formMessage || !submitButton) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const guardianData = document.getElementById("guardianSignatureData")?.value || "";

    if (!guardianData) {
      formMessage.textContent = "Bitte die Unterschrift eintragen / يرجى إدخال التوقيع";
      formMessage.className = "form-message err";
      return;
    }

    if (!form.reportValidity()) {
      formMessage.textContent =
        "Bitte alle Pflichtfelder korrekt ausfüllen / يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح";
      formMessage.className = "form-message err";
      return;
    }

    const policyConsentValue =
      document.querySelector('input[name="policyConsent"]:checked')?.value || "";

    if (policyConsentValue !== "نعم") {
      formMessage.textContent =
        "Die Anmeldung ist nur mit Zustimmung zu den Regeln und Richtlinien möglich / لا يمكن إتمام التسجيل إلا بعد الموافقة على القوانين والسياسات";
      formMessage.className = "form-message err";
      return;
    }

    try {
      formMessage.textContent = "";
      formMessage.className = "form-message";

      setSubmitButtonLoading(submitButton, true);
      resetSendingOverlayText();
      setSendingOverlayVisible(true);

      await nextPaint();
      await nextPaint();

      startSendingOverlaySequence();

      const data = getFormDataObject(form);

      const response = await fetch("https://iqraa-akademie-backend.onrender.com/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Submit failed");
      }

      stopSendingOverlaySequence();

      setSendingOverlayText({
        title: "Anmeldung erfolgreich gesendet",
        deText: "Weiterleitung wird vorbereitet",
        arText: "تم إرسال الاستمارة بنجاح، يتم الآن تحويلكم",
      });

      await delay(650);

      form.reset();

      if (guardianPad) guardianPad.clearSignature();

      setupConditionalField("chronicIllness", "chronicDetailsWrap", "chronicDetails");
      setupConditionalField("allergy", "allergyDetailsWrap", "allergyDetails");

      window.location.href = "registration-success.html";
    } catch (error) {
      console.error("Registration submit error:", error);

      stopSendingOverlaySequence();
      setSendingOverlayVisible(false);
      resetSendingOverlayText();

      formMessage.textContent =
        "Die Anmeldung konnte noch nicht gesendet werden. Bitte später erneut versuchen oder SMTP/Backend prüfen. / تعذر إرسال التسجيل حالياً. يرجى المحاولة لاحقاً أو التحقق من الخادم والبريد.";
      formMessage.className = "form-message err";
    } finally {
      setSubmitButtonLoading(submitButton, false);
    }
  });
}

function protectMediaElements(elements) {
  elements.forEach((element) => {
    if (element.dataset.protectedMedia === "true") return;

    element.dataset.protectedMedia = "true";
    element.setAttribute("draggable", "false");

    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    element.addEventListener("dragstart", (event) => {
      event.preventDefault();
    });

    element.addEventListener("mousedown", (event) => {
      if (event.button === 2) {
        event.preventDefault();
      }
    });
  });
}

function initMediaProtection() {
  protectMediaElements(document.querySelectorAll("img, video"));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        if (node.matches("img, video")) {
          protectMediaElements([node]);
        }

        const nestedMedia = node.querySelectorAll?.("img, video");
        if (nestedMedia?.length) {
          protectMediaElements(nestedMedia);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (
      key === "f12" ||
      (event.ctrlKey && event.shiftKey && (key === "i" || key === "j" || key === "c")) ||
      (event.ctrlKey && key === "u")
    ) {
      event.preventDefault();
    }
  });
}

function initHeroVideos() {
  const videos = document.querySelectorAll(".hero video, .hero-media-video");

  videos.forEach((video) => {
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("preload", "auto");

    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener("loadeddata", tryPlay, { once: true });
    }

    video.addEventListener("canplay", tryPlay, { once: true });
  });
}

function initPageTransitions() {
  if (document.body.dataset.pageTransitionReady === "true") return;
  document.body.dataset.pageTransitionReady = "true";

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    if (pageTransitionActive) {
      event.preventDefault();
      return;
    }

    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hasAttribute("download")) return;

    const rawHref = link.getAttribute("href");
    if (!rawHref) return;

    const href = rawHref.trim();

    if (
      href === "" ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      return;
    }

    if (link.target && link.target.toLowerCase() === "_blank") return;
    if (link.getAttribute("rel")?.includes("external")) return;
    if (link.classList.contains("media-intro-link")) return;

    const destination = new URL(link.href, window.location.href);

    if (destination.origin !== window.location.origin) return;

    const currentUrlWithoutHash = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const destinationWithoutHash = `${destination.origin}${destination.pathname}${destination.search}`;

    if (destinationWithoutHash === currentUrlWithoutHash && destination.hash) {
      return;
    }

    event.preventDefault();
    pageTransitionActive = true;

    showPageLoader();

    await delay(110);
    window.location.href = destination.href;
  });
}

function initReviewsIntro() {
  const overlay = document.getElementById("reviewsIntroOverlay");
  if (!overlay) return;

  let openTimer = null;
  let closeTimer = null;
  let hideTimer = null;

  const openDuration = 900;
  const holdDuration = 950;
  const closeDuration = 800;
  const overlayFadeDuration = 550;

  function clearIntroTimers() {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function finishIntro() {
    overlay.classList.add("is-hiding");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.active = "false";
    document.body.classList.remove("reviews-intro-lock");

    hideTimer = window.setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("is-opening", "is-open", "is-closing", "is-hiding");
    }, overlayFadeDuration);
  }

  function runIntro() {
    clearIntroTimers();

    overlay.classList.remove("hidden", "is-opening", "is-open", "is-closing", "is-hiding");
    overlay.setAttribute("aria-hidden", "false");
    overlay.dataset.active = "true";
    document.body.classList.add("reviews-intro-lock");

    void overlay.offsetWidth;

    overlay.classList.add("is-opening");

    openTimer = window.setTimeout(() => {
      overlay.classList.remove("is-opening");
      overlay.classList.add("is-open");

      closeTimer = window.setTimeout(() => {
        overlay.classList.remove("is-open");
        overlay.classList.add("is-closing");

        hideTimer = window.setTimeout(() => {
          finishIntro();
        }, closeDuration);
      }, holdDuration);
    }, openDuration);
  }

  runIntro();
}

document.addEventListener("DOMContentLoaded", async () => {
  schedulePageReady(180);

  await loadImages();
  initReveal();
  setupSignaturePads();
  setupConditionalField("chronicIllness", "chronicDetailsWrap", "chronicDetails");
  setupConditionalField("allergy", "allergyDetailsWrap", "allergyDetails");
  initMediaProtection();
  initHeroVideos();
  resetSendingOverlayText();
  initPageTransitions();
  initReviewsIntro();
});

window.addEventListener("pageshow", (event) => {
  if (isHistoryNavigation(event)) {
    restorePageAfterHistoryNavigation();
  }
});

window.addEventListener("pagehide", () => {
  pageTransitionActive = false;
});

window.addEventListener("load", () => {
  schedulePageReady(0);
  initHeroVideos();
});