async function loadImages() {
  try {
    const isFileProtocol = window.location.protocol === "file:";

    if (isFileProtocol) {
      return;
    }

    const assetVersion = "20260327-v3";

    const res = await fetch(`/data/images.json?v=${assetVersion}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to load images.json: ${res.status}`);
    }

    const data = await res.json();

    function render(containerId, images) {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(images)) return;

      container.innerHTML = "";

      images.forEach((src) => {
        const card = document.createElement("article");
        card.className = "media-card reveal";

        const img = document.createElement("img");
        img.src = `${src}?v=${assetVersion}`;
        img.loading = "lazy";
        img.alt = "Iqraa Akademie";
        img.draggable = false;

        img.onerror = () => {
          console.error("Failed image:", img.src);
          card.remove();
        };

        card.appendChild(img);
        container.appendChild(card);
      });

      protectMediaElements(container.querySelectorAll("img, video"));
    }

    function populateReviewsIntroCards(images) {
      const introCards = document.querySelectorAll(".reviews-fan-card");
      if (!introCards.length) return;

      introCards.forEach((card, index) => {
        card.innerHTML = "";
        card.classList.add("is-empty");

        if (!Array.isArray(images) || !images[index]) {
          return;
        }

        const img = document.createElement("img");
        img.src = `${images[index]}?v=${assetVersion}`;
        img.loading = "eager";
        img.alt = "Iqraa Akademie Bewertung";
        img.draggable = false;

        img.onerror = () => {
          card.innerHTML = "";
          card.classList.add("is-empty");
        };

        img.onload = () => {
          card.classList.remove("is-empty");
        };

        card.appendChild(img);
      });

      protectMediaElements(document.querySelectorAll(".reviews-fan-card img"));
    }

    render("galleryGrid", data.gallery);
    render("heroKidsGrid", data.hero);
    render("certificateGrid", data.certificates);
    render("reviewGrid", data.reviews);
    populateReviewsIntroCards(Array.isArray(data.reviews) ? data.reviews.slice(0, 3) : []);

    initReveal();
  } catch (error) {
    console.error("Image loading error:", error);
  }
}

function initReveal() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
    }
  );

  revealItems.forEach((item) => observer.observe(item));
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
      formMessage.textContent = "Bitte alle Pflichtfelder korrekt ausfüllen / يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح";
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

  let isTransitioning = false;

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    if (isTransitioning) {
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

    const destination = new URL(link.href, window.location.href);

    if (destination.origin !== window.location.origin) return;

    const currentUrlWithoutHash = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const destinationWithoutHash = `${destination.origin}${destination.pathname}${destination.search}`;

    if (destinationWithoutHash === currentUrlWithoutHash && destination.hash) {
      return;
    }

    event.preventDefault();
    isTransitioning = true;

    const loader = document.getElementById("pageLoader");

    if (loader) {
      loader.setAttribute("aria-hidden", "false");
    }

    document.body.classList.remove("loaded");

    await delay(420);
    window.location.href = destination.href;
  });
}

function initReviewsIntro() {
  const overlay = document.getElementById("reviewsIntroOverlay");
  const skipButton = document.getElementById("skipReviewsIntro");
  const replayButton = document.getElementById("replayReviewsIntro");

  if (!overlay) return;

  let openTimer = null;
  let closeTimer = null;
  let hideTimer = null;
  let introIsRunning = false;

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

  function hideOverlayImmediately() {
    clearIntroTimers();
    introIsRunning = false;

    overlay.classList.remove("is-opening", "is-open", "is-closing", "is-hiding");
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.active = "false";
    document.body.classList.remove("reviews-intro-lock");
  }

  function finishIntro() {
    overlay.classList.add("is-hiding");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.active = "false";
    document.body.classList.remove("reviews-intro-lock");

    hideTimer = window.setTimeout(() => {
      introIsRunning = false;
      overlay.classList.add("hidden");
      overlay.classList.remove("is-opening", "is-open", "is-closing", "is-hiding");
    }, overlayFadeDuration);
  }

  function runIntro() {
    clearIntroTimers();
    introIsRunning = true;

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

  function closeIntroNow() {
    hideOverlayImmediately();
  }

  if (skipButton) {
    skipButton.addEventListener("click", closeIntroNow);
  }

  if (replayButton) {
    replayButton.addEventListener("click", runIntro);
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeIntroNow();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && introIsRunning) {
      closeIntroNow();
    }
  });

  runIntro();
}

document.addEventListener("DOMContentLoaded", () => {
  loadImages();
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

window.addEventListener("load", () => {
  setTimeout(() => {
    document.body.classList.add("loaded");
  }, 2000);

  initHeroVideos();
});