async function loadImages() {

  const res = await fetch("/data/images.json");
  const data = await res.json();

  function render(containerId, images) {

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    images.forEach(src => {

      const card = document.createElement("article");
      card.className = "media-card reveal";

      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";

      img.onerror = () => card.remove();

      card.appendChild(img);
      container.appendChild(card);

    });

  }

  render("galleryGrid", data.gallery);
  render("heroKidsGrid", data.hero);
  render("certificateGrid", data.certificates);
  render("reviewGrid", data.reviews);

}

loadImages();