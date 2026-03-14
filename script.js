async function loadImages() {
  try {
    const isFileProtocol = window.location.protocol === "file:";

    if (isFileProtocol) {
      return;
    }

    const res = await fetch("/data/images.json");
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
        img.src = src;
        img.loading = "lazy";
        img.alt = "Iqraa Akademie";
        img.draggable = false;

        img.onerror = () => {
          card.remove();
        };

        card.appendChild(img);
        container.appendChild(card);
      });

      protectMediaElements(container.querySelectorAll("img, video"));
    }

    render("galleryGrid", data.gallery);
    render("heroKidsGrid", data.hero);
    render("certificateGrid", data.certificates);
    render("reviewGrid", data.reviews);

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

function setSendingOverlayVisible(visible) {
  const overlay = document.getElementById("sendingOverlay");
  if (!overlay) return;

  overlay.classList.toggle("hidden", !visible);
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
}

function setupSignaturePads() {
  const guardianPad = setupSignaturePad("guardianSignaturePad", "guardianSignatureData");
  const teacherPad = setupSignaturePad("teacherSignaturePad", "teacherSignatureData");

  document.querySelectorAll(".signature-clear-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-target");

      if (target === "guardianSignaturePad" && guardianPad) {
        guardianPad.clearSignature();
      }

      if (target === "teacherSignaturePad" && teacherPad) {
        teacherPad.clearSignature();
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
    const teacherData = document.getElementById("teacherSignatureData")?.value || "";

    if (!guardianData || !teacherData) {
      formMessage.textContent = "Bitte beide Unterschriften eintragen / يرجى إدخال التوقيعين";
      formMessage.className = "form-message err";
      return;
    }

    if (!form.reportValidity()) {
      formMessage.textContent = "Bitte alle Pflichtfelder korrekt ausfüllen / يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح";
      formMessage.className = "form-message err";
      return;
    }

    const originalButtonText = submitButton.textContent;

    try {
      submitButton.disabled = true;
      submitButton.textContent = "Wird gesendet... / جاري الإرسال...";
      formMessage.textContent = "";
      formMessage.className = "form-message";
      setSendingOverlayVisible(true);

      const data = getFormDataObject(form);

      const response = await fetch("http://localhost:3000/api/register", {
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

      form.reset();

      if (guardianPad) guardianPad.clearSignature();
      if (teacherPad) teacherPad.clearSignature();

      setupConditionalField("chronicIllness", "chronicDetailsWrap", "chronicDetails");
      setupConditionalField("allergy", "allergyDetailsWrap", "allergyDetails");

      window.location.href = "registration-success.html";
    } catch (error) {
      console.error("Registration submit error:", error);
      setSendingOverlayVisible(false);
      formMessage.textContent =
        "Die Anmeldung konnte noch nicht gesendet werden. Bitte später erneut versuchen oder SMTP/Backend prüfen. / تعذر إرسال التسجيل حالياً. يرجى المحاولة لاحقاً أو التحقق من الخادم والبريد.";
      formMessage.className = "form-message err";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
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

document.addEventListener("DOMContentLoaded", () => {
  loadImages();
  initReveal();
  setupSignaturePads();
  setupConditionalField("chronicIllness", "chronicDetailsWrap", "chronicDetails");
  setupConditionalField("allergy", "allergyDetailsWrap", "allergyDetails");
  initMediaProtection();
  initHeroVideos();
});

window.addEventListener("load", () => {
  setTimeout(() => {
    document.body.classList.add("loaded");
  }, 2000);

  initHeroVideos();
});