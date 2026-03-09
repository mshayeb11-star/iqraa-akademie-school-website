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

/* HERO VIDEO SMART LOADING */

function initHeroVideos() {
  const hero = document.querySelector(".hero");
  const videos = document.querySelectorAll(".hero-left video, .hero-right video");

  if (!hero || videos.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    videos.forEach(v => v.play());
    return;
  }

  const heroObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          videos.forEach(v => {
            v.play().catch(() => {});
          });
          heroObserver.disconnect();
        }
      });
    },
    {
      threshold: 0.25
    }
  );

  heroObserver.observe(hero);
}

document.addEventListener("DOMContentLoaded", () => {
  loadImages();
  initReveal();
  initHeroVideos();
});