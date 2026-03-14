/* =====================================================
   REVEAL ANIMATIONS
===================================================== */

const revealElements = document.querySelectorAll(".reveal");

function revealOnScroll() {
  const trigger = window.innerHeight * 0.85;

  revealElements.forEach(el => {
    const rect = el.getBoundingClientRect();

    if (rect.top < trigger) {
      el.classList.add("in-view");
    }
  });
}

window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);



/* =====================================================
   MOBILE REVEAL FIX (important for registration page)
===================================================== */

function forceRevealOnMobile() {
  if (window.innerWidth <= 900) {
    document.querySelectorAll(".reveal").forEach(el => {
      el.classList.add("in-view");
    });
  }
}

window.addEventListener("load", forceRevealOnMobile);



/* =====================================================
   HERO VIDEO START FIX
===================================================== */

function forceHeroVideoStart() {
  const videos = document.querySelectorAll("video");

  videos.forEach(video => {

    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.muted = true;

    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }

  });
}

window.addEventListener("load", forceHeroVideoStart);



/* =====================================================
   SOFT MEDIA DOWNLOAD PROTECTION
===================================================== */

function mediaProtection() {

  /* disable right click on media */
  document.querySelectorAll("img, video").forEach(el => {

    el.addEventListener("contextmenu", e => {
      e.preventDefault();
    });

    el.setAttribute("draggable", "false");

  });

  /* block common dev shortcuts */
  document.addEventListener("keydown", function(e) {

    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && e.key === "I") ||
      (e.ctrlKey && e.shiftKey && e.key === "J") ||
      (e.ctrlKey && e.key === "U")
    ) {
      e.preventDefault();
    }

  });

}

window.addEventListener("load", mediaProtection);



/* =====================================================
   PAGE LOADER (registration page)
===================================================== */

window.addEventListener("load", function () {

  const loader = document.getElementById("pageLoader");

  if (loader) {

    setTimeout(() => {

      loader.style.opacity = "0";

      setTimeout(() => {
        loader.style.display = "none";
      }, 400);

    }, 2000);

  }

});



/* =====================================================
   FORM SUBMIT OVERLAY
===================================================== */

const registrationForm = document.getElementById("registrationForm");

if (registrationForm) {

  registrationForm.addEventListener("submit", function () {

    const overlay = document.getElementById("sendingOverlay");

    if (overlay) {
      overlay.classList.remove("hidden");
    }

  });

}



/* =====================================================
   GALLERY AUTO LOADER
===================================================== */

async function loadImages() {

  try {

    const res = await fetch("/data/images.json");

    if (!res.ok) return;

    const data = await res.json();

    function render(containerId, images) {

      const container = document.getElementById(containerId);

      if (!container || !Array.isArray(images)) return;

      container.innerHTML = "";

      images.forEach(src => {

        const card = document.createElement("article");
        card.className = "media-card reveal";

        const img = document.createElement("img");
        img.src = src;
        img.loading = "lazy";
        img.draggable = false;

        card.appendChild(img);
        container.appendChild(card);

      });

    }

    render("galleryGrid", data.gallery);
    render("certificateGrid", data.certificates);
    render("reviewGrid", data.reviews);
    render("heroKidsGrid", data.hero);

  } catch (err) {

    console.warn("Images loading skipped");

  }

}

window.addEventListener("load", loadImages);