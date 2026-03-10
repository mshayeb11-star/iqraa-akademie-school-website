async function loadImages() {
  try {
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

        img.onerror = () => {
          card.remove();
        };

        card.appendChild(img);
        container.appendChild(card);
      });
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

  return { clearSignature, hiddenInput };
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

function setupSignaturePads() {
  const guardianPad = setupSignaturePad("guardianSignaturePad", "guardianSignatureData");
  const teacherPad = setupSignaturePad("teacherSignaturePad", "teacherSignatureData");

  document.querySelectorAll(".signature-clear-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-target");
      if (target === "guardianSignaturePad" && guardianPad) guardianPad.clearSignature();
      if (target === "teacherSignaturePad" && teacherPad) teacherPad.clearSignature();
    });
  });

  const form = document.getElementById("registrationForm");
  const formMessage = document.getElementById("formMessage");

  if (!form || !formMessage) return;

  form.addEventListener("submit", (event) => {
    const guardianData = document.getElementById("guardianSignatureData")?.value || "";
    const teacherData = document.getElementById("teacherSignatureData")?.value || "";

    if (!guardianData || !teacherData) {
      event.preventDefault();
      formMessage.textContent = "Bitte beide Unterschriften eintragen / يرجى إدخال التوقيعين";
      formMessage.className = "form-message err";
      return;
    }

    formMessage.textContent = "Formular geprüft / تم التحقق من الاستمارة";
    formMessage.className = "form-message ok";

    event.preventDefault();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadImages();
  initReveal();
  setupSignaturePads();
  setupConditionalField("chronicIllness", "chronicDetailsWrap", "chronicDetails");
  setupConditionalField("allergy", "allergyDetailsWrap", "allergyDetails");
});