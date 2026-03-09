import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildPdfBuffer(formData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Iqraa Akademie – Anmeldung", { align: "center" });
    doc.moveDown();
    doc.fontSize(11);

    const lines = [
      ["Name des Kindes", formData.studentName],
      ["Geburtsdatum", formData.birthDate],
      ["Geschlecht", formData.gender],
      ["Schulstufe", formData.schoolLevel],
      ["Name des Vaters", formData.fatherName],
      ["Name der Mutter", formData.motherName],
      ["Name des Erziehungsberechtigten", formData.guardianName],
      ["Telefon", formData.phone],
      ["E-Mail", formData.guardianEmail],
      ["Adresse", formData.address],
      ["Hinweise", formData.notes],
      ["Unterschrift", formData.guardianSignature],
      ["Datum", formData.signatureDate],
      ["Preis", "40,-€ / Monat"],
    ];

    lines.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value || "-");
      doc.moveDown(0.4);
    });

    doc.moveDown();
    doc.font("Helvetica-Bold").text("Iqraa Akademie");
    doc.font("Helvetica").text("Dinxperloer Straße 92, 46399 Bocholt");
    doc.text("kontakt@iqraa-akademie.de");
    doc.end();
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "IQRAA backend is running." });
});

app.post("/api/register", async (req, res) => {
  try {
    const data = req.body || {};

    if (!data.studentName || !data.guardianName || !data.guardianEmail || !data.phone) {
      return res.status(400).json({ message: "Pflichtfelder fehlen." });
    }

    const pdfBuffer = await buildPdfBuffer(data);
    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO || process.env.SMTP_USER,
      subject: `Neue Anmeldung – ${data.studentName}`,
      text: `Neue Anmeldung von ${data.studentName} (${data.guardianName}).`,
      attachments: [
        {
          filename: `anmeldung-${(data.studentName || "kind").replace(/\s+/g, "-").toLowerCase()}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.guardianEmail,
      subject: "Ihre Anmeldung bei der Iqraa Akademie",
      text: `Vielen Dank für Ihre Anmeldung. Im Anhang finden Sie Ihre PDF-Kopie.\n\nDanke!`,
      attachments: [
        {
          filename: "iqraa-anmeldung.pdf",
          content: pdfBuffer,
        },
      ],
    });

    res.json({ message: "Anmeldung erfolgreich gesendet. Die PDF wurde per E-Mail vorbereitet." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "E-Mail/PDF konnte noch nicht gesendet werden. Bitte SMTP-Daten prüfen." });
  }
});

app.listen(PORT, () => {
  console.log(`IQRAA backend running on http://localhost:${PORT}`);
});
