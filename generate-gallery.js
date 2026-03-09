const fs = require("fs");
const path = require("path");

function getImages(folderPath) {
  const fullPath = path.join(__dirname, folderPath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  return fs
    .readdirSync(fullPath)
    .filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((file) => `/${folderPath}/${file}`);
}

const data = {
  gallery: getImages("images/gallery"),
  hero: getImages("images/hero"),
  certificates: getImages("images/certificates"),
  reviews: getImages("images/reviews")
};

const dataFolder = path.join(__dirname, "data");
if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder, { recursive: true });
}

fs.writeFileSync(
  path.join(dataFolder, "images.json"),
  JSON.stringify(data, null, 2),
  "utf8"
);

console.log("images.json generated successfully");