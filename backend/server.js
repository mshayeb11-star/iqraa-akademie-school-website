import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBSITE_BASE_URL =
  process.env.WEBSITE_BASE_URL || "https://iqraa-akademie.de";
const LOGO_URL = `${WEBSITE_BASE_URL}/logo.png`;

const allowedOrigins = [
  "https://iqraa-akademie.de",
  "https://www.iqraa-akademie.de",
  "https://iqraa-akademie.netlify.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Zu viele Anfragen. Bitte später erneut versuchen.",
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log("Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));

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

function safeValue(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return String(value);
}

function escapeHtml(value) {
  return safeValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function truncate(value, maxLength) {
  return normalizeString(value).slice(0, maxLength);
}

function isValidEmail(value) {
  const email = normalizeString(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAllowedValue(value, allowedValues) {
  if (value === undefined || value === null || value === "") return true;
  return allowedValues.includes(String(value));
}

function isReasonableSignature(value) {
  if (!value) return false;
  const str = String(value);
  return str.startsWith("data:image/png;base64,") && str.length <= 2_000_000;
}

function sanitizeFormData(rawData = {}) {
  return {
    website: truncate(rawData.website, 200),

    studentName: truncate(rawData.studentName, 120),
    birthDate: truncate(rawData.birthDate, 30),
    address: truncate(rawData.address, 250),
    guardianName: truncate(rawData.guardianName, 120),
    phone: truncate(rawData.phone, 50),
    guardianEmail: truncate(rawData.guardianEmail, 160),
    homeLanguages: truncate(rawData.homeLanguages, 200),

    level: truncate(rawData.level, 50),
    gender: truncate(rawData.gender, 50),
    knowsArabic: truncate(rawData.knowsArabic, 50),

    mediaConsent: truncate(rawData.mediaConsent, 50),

    scheduleDay1: truncate(rawData.scheduleDay1, 50),
    scheduleTime1: truncate(rawData.scheduleTime1, 50),
    scheduleDay2: truncate(rawData.scheduleDay2, 50),
    scheduleTime2: truncate(rawData.scheduleTime2, 50),

    startDate: truncate(rawData.startDate, 30),
    chronicIllness: truncate(rawData.chronicIllness, 50),
    allergy: truncate(rawData.allergy, 50),
    chronicDetails: truncate(rawData.chronicDetails, 200),
    allergyDetails: truncate(rawData.allergyDetails, 200),

    policyConsent: truncate(rawData.policyConsent, 50),
    paymentMethod: truncate(rawData.paymentMethod, 50),
    registrationDate: truncate(rawData.registrationDate, 30),
    privacyAccepted: rawData.privacyAccepted,

    parentNotes: truncate(rawData.parentNotes, 500),

    guardianSignatureData: rawData.guardianSignatureData || "",
    teacherSignatureData: rawData.teacherSignatureData || "",
  };
}

function validateFormData(data) {
  if (data.website) {
    return "Spam detected.";
  }

  if (!data.studentName || !data.guardianName || !data.guardianEmail || !data.phone) {
    return "Required fields are missing.";
  }

  if (!isValidEmail(data.guardianEmail)) {
    return "Invalid email address.";
  }

  if (!isReasonableSignature(data.guardianSignatureData)) {
    return "Guardian signature is required.";
  }

  if (
    !isAllowedValue(data.level, ["مبتدئ", "متوسط", "متقدم"]) ||
    !isAllowedValue(data.gender, ["ذكر", "أنثى"]) ||
    !isAllowedValue(data.knowsArabic, ["نعم", "لا"]) ||
    !isAllowedValue(data.mediaConsent, ["نعم", "لا"]) ||
    !isAllowedValue(data.chronicIllness, ["نعم", "لا"]) ||
    !isAllowedValue(data.allergy, ["نعم", "لا"]) ||
    !isAllowedValue(data.policyConsent, ["نعم", "لا"]) ||
    !isAllowedValue(data.paymentMethod, ["نقدي", "تحويل بنكي"])
  ) {
    return "Invalid form values detected.";
  }

  return null;
}

function buildScheduleLines(data) {
  const row1 =
    data.scheduleDay1 || data.scheduleTime1
      ? `${safeValue(data.scheduleDay1)} - ${safeValue(data.scheduleTime1)}`
      : null;

  const row2 =
    data.scheduleDay2 || data.scheduleTime2
      ? `${safeValue(data.scheduleDay2)} - ${safeValue(data.scheduleTime2)}`
      : null;

  return [row1, row2].filter(Boolean);
}

function boolBadge(value) {
  const yes =
    value === "نعم" ||
    value === "yes" ||
    value === "ja" ||
    value === true;

  const no =
    value === "لا" ||
    value === "no" ||
    value === "nein" ||
    value === false;

  if (yes) {
    return `<span class="status-badge status-yes">Ja / نعم</span>`;
  }

  if (no) {
    return `<span class="status-badge status-no">Nein / لا</span>`;
  }

  return `<span class="value-dash">-</span>`;
}

function buildEmailHeaderBlock() {
  return `
    <div style="background:linear-gradient(135deg,#f57bae,#66b0e9);border-radius:30px 30px 0 0;padding:34px 28px 28px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0));pointer-events:none;"></div>
      <img src="${LOGO_URL}" alt="Iqraa Akademie Logo" style="width:170px;max-width:100%;height:auto;display:block;margin:0 auto 14px auto;position:relative;z-index:1;">
      <div style="font-size:30px;font-weight:900;color:#ffffff;line-height:1.2;position:relative;z-index:1;">Iqraa Akademie</div>
      <div style="font-size:26px;color:#ffffff;line-height:1.45;font-family:'Cairo', Arial, sans-serif;position:relative;z-index:1;">أكاديمية اقرأ</div>
    </div>
  `;
}

function buildAcademyText(data) {
  return `
Neue Anmeldung bei der Iqraa Akademie / تسجيل جديد في أكاديمية اقرأ

Name des Kindes / اسم الطفل: ${safeValue(data.studentName)}
Name des Erziehungsberechtigten / اسم ولي الأمر: ${safeValue(data.guardianName)}
Telefon / رقم الهاتف: ${safeValue(data.phone)}
E-Mail der Eltern / بريد ولي الأمر: ${safeValue(data.guardianEmail)}
Kursniveau / مستوى الدورة: ${safeValue(data.level)}
Anmeldedatum / تاريخ التسجيل: ${safeValue(data.registrationDate)}

Die ausgefüllte Anmeldung ist als PDF im Anhang enthalten.
استمارة التسجيل الكاملة مرفقة بصيغة PDF في هذه الرسالة.
`.trim();
}

function buildAcademyHtml(data) {
  return `
    <div style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,sans-serif;">
      <div style="max-width:700px;margin:0 auto;padding:28px 16px;">
        ${buildEmailHeaderBlock()}

        <div style="background:#ffffff;border-radius:0 0 30px 30px;padding:30px 24px;box-shadow:0 12px 32px rgba(31,43,58,0.08);color:#1f2b3a;">
          <div style="text-align:center;margin-bottom:22px;">
            <div style="font-size:24px;font-weight:900;color:#24314f;">Neue Anmeldung eingegangen</div>
            <div style="font-size:22px;font-weight:700;color:#b34f86;font-family:'Cairo', Arial, sans-serif;direction:rtl;">تم استلام تسجيل جديد</div>
          </div>

          <div style="background:#f9fbff;border:1px solid #e7edf5;border-radius:22px;padding:20px 18px;margin-bottom:18px;">
            <div style="font-size:16px;line-height:2;color:#24314f;">
              <strong>Name des Kindes / اسم الطفل:</strong> ${escapeHtml(data.studentName)}<br>
              <strong>Name des Erziehungsberechtigten / اسم ولي الأمر:</strong> ${escapeHtml(data.guardianName)}<br>
              <strong>Telefon / رقم الهاتف:</strong> ${escapeHtml(data.phone)}<br>
              <strong>E-Mail der Eltern / بريد ولي الأمر:</strong> ${escapeHtml(data.guardianEmail)}<br>
              <strong>Kursniveau / مستوى الدورة:</strong> ${escapeHtml(data.level)}<br>
              <strong>Anmeldedatum / تاريخ التسجيل:</strong> ${escapeHtml(data.registrationDate)}
            </div>
          </div>

          <div style="background:linear-gradient(135deg,rgba(245,123,174,0.10),rgba(102,176,233,0.10));border-radius:20px;padding:16px 15px;margin-bottom:20px;">
            <div style="font-size:15px;line-height:1.9;color:#425168;">
              Die ausgefüllte Anmeldung befindet sich als PDF im Anhang.<br>
              استمارة التسجيل الكاملة مرفقة بصيغة PDF في هذه الرسالة.
            </div>
          </div>

          <div style="margin-top:20px;padding:18px;border-radius:18px;background:#f8fbff;">
            <p style="margin:0;font-size:14px;line-height:1.8;color:#4a5a70;">
              <strong>Iqraa Akademie</strong><br>
              Dinxperloer Strasse 92, 46399 Bocholt<br>
              kontakt@iqraa-akademie.de
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildParentHtml(data) {
  const studentName = escapeHtml(data.studentName);

  return `
    <div style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,sans-serif;">
      <div style="max-width:700px;margin:0 auto;padding:28px 16px;">
        ${buildEmailHeaderBlock()}

        <div style="background:#ffffff;border-radius:0 0 30px 30px;padding:30px 24px;box-shadow:0 12px 32px rgba(31,43,58,0.08);color:#1f2b3a;">
          <div style="text-align:center;margin-bottom:22px;">
            <div style="font-size:24px;font-weight:900;color:#24314f;">Ihre Anmeldung ist eingegangen</div>
            <div style="font-size:22px;font-weight:700;color:#b34f86;font-family:'Cairo', Arial, sans-serif;direction:rtl;">تم استلام التسجيل بنجاح</div>
          </div>

          <p style="margin-top:0;font-size:18px;font-weight:700;color:#24314f;">Hallo,</p>
          <p style="font-size:15px;line-height:1.9;color:#425168;">
            vielen Dank für Ihre Anmeldung von <strong>${studentName}</strong> bei der Iqraa Akademie.
            Wir haben Ihre Registrierung erfolgreich erhalten.
          </p>

          <p style="font-size:15px;line-height:1.9;color:#425168;">
            Wir werden Ihre Anmeldung prüfen und uns bei Bedarf mit weiteren Informationen bei Ihnen melden.
          </p>

          <hr style="border:none;border-top:1px solid #e8edf3;margin:26px 0;">

          <p style="margin:0 0 10px 0;font-size:18px;font-weight:700;direction:rtl;text-align:right;color:#24314f;font-family:'Cairo', Arial, sans-serif;">مرحباً،</p>
          <p style="font-size:15px;line-height:2;direction:rtl;text-align:right;color:#425168;font-family:'Cairo', Arial, sans-serif;">
            شكراً لكم على تسجيل <strong>${studentName}</strong> في أكاديمية اقرأ.
            لقد استلمنا طلب التسجيل بنجاح.
          </p>

          <p style="font-size:15px;line-height:2;direction:rtl;text-align:right;color:#425168;font-family:'Cairo', Arial, sans-serif;">
            سنقوم بمراجعة طلب التسجيل، وسنتواصل معكم إذا احتجنا إلى أي معلومات إضافية.
          </p>

          <div style="background:#f9fbff;border:1px solid #e7edf5;border-radius:22px;padding:18px 16px;margin-top:24px;">
            <div style="font-size:15px;line-height:1.9;color:#425168;">
              <strong>Name des Kindes / اسم الطفل:</strong> ${studentName}<br>
              <strong>Anmeldedatum / تاريخ التسجيل:</strong> ${escapeHtml(data.registrationDate)}
            </div>
          </div>

          <div style="margin-top:28px;padding:18px;border-radius:18px;background:#f8fbff;">
            <p style="margin:0;font-size:14px;line-height:1.8;color:#4a5a70;">
              <strong>Iqraa Akademie</strong><br>
              Dinxperloer Strasse 92, 46399 Bocholt<br>
              kontakt@iqraa-akademie.de
            </p>
          </div>

          <p style="margin:22px 0 0 0;font-size:13px;color:#6c7a8e;">
            Diese Nachricht wurde automatisch erstellt. / هذه رسالة تأكيد تلقائية
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildParentText(data) {
  return `
Ihre Anmeldung bei der Iqraa Akademie / تأكيد التسجيل في أكاديمية اقرأ

Hallo,
vielen Dank für Ihre Anmeldung von ${safeValue(data.studentName)} bei der Iqraa Akademie.
Wir haben Ihre Registrierung erfolgreich erhalten.

Wir werden Ihre Anmeldung prüfen und uns bei Bedarf mit weiteren Informationen bei Ihnen melden.

مرحباً،
شكراً لكم على تسجيل ${safeValue(data.studentName)} في أكاديمية اقرأ.
لقد استلمنا طلب التسجيل بنجاح.

سنقوم بمراجعة طلب التسجيل، وسنتواصل معكم إذا احتجنا إلى أي معلومات إضافية.

Iqraa Akademie
Dinxperloer Strasse 92, 46399 Bocholt
kontakt@iqraa-akademie.de
`.trim();
}

function renderPoliciesHtml() {
  const germanRules = [
    "Bitte sorgen Sie für eine regelmäßige Teilnahme des Kindes, damit ein bestmöglicher Lernfortschritt erreicht werden kann.",
    "Fehlzeiten sind nur in dringenden Fällen oder bei Krankheit erlaubt.",
    "Bei verspäteter Abholung des Kindes nach dem Unterricht wird eine Gebühr von 10 Euro berechnet.",
    "Hausaufgaben müssen fristgerecht erledigt werden.",
    "Von den Schülerinnen und Schülern wird ein höflicher und respektvoller Umgang mit der Lehrkraft und den Mitschülern erwartet.",
    'Die Kinder sollen ein Heft für den Abend, ein Heft für den Tag, Buntstifte, einen Bleistift und einen Radiergummi mitbringen.',
    'Beim Ausfüllen der Anmeldung sind 15 Euro als Gebühr für das Iqraa-Buch zu zahlen, damit das Kind sein eigenes Exemplar erhält.',
    "Alle persönlichen Daten der Schülerinnen und Schüler werden vertraulich und entsprechend den geltenden Datenschutzrichtlinien behandelt."
  ];

  const arabicRules = [
    "نرجو الالتزام بانتظام حضور الطفل لتحقيق أفضل مستوى من التقدم الدراسي.",
    "يسمح للطلاب بالغياب فقط في الحالات الطارئة أو المرضية.",
    "في حال التأخير في استلام الطفل بعد الدرس، ستفرض غرامة قدرها (عشرة يورو).",
    "يجب إتمام الواجبات المنزلية في الموعد المحدد.",
    "يتوقع من الطلاب التصرف بأدب واحترام تجاه المعلم وزملائهم.",
    'يجب على الطلاب إحضار دفتر ليلي، دفتر نهاري، أقلام تلوين، قلم رصاص وممحاة.',
    'عند تعبئة استمارة التسجيل، يرجى دفع (15 يورو) كرسوم لكتاب "إقرأ" لضمان استلام الطفل نسخته الخاصة.',
    "سيتم التعامل مع جميع البيانات الشخصية الخاصة بالطلاب بسرية تامة وفقًا لسياسات الخصوصية المعتمدة."
  ];

  const germanList = germanRules
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const arabicList = arabicRules
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div class="policy-wrap">
      <div class="policy-grid">
        <div class="policy-column">
          <div class="policy-subhead">Regeln und Richtlinien des Unterrichts</div>
          <ul class="policy-list german-list">
            ${germanList}
          </ul>
        </div>

        <div class="policy-column">
          <div class="policy-subhead rtl-head">القوانين والسياسات الخاصة بالدورة التعليمية</div>
          <ul class="policy-list arabic-list">
            ${arabicList}
          </ul>
        </div>
      </div>

      <div class="privacy-box">
        <div class="privacy-title">Datenschutz / الخصوصية</div>
        <div class="privacy-text">
          Mit dem Absenden stimmen Sie zu, dass Ihre Angaben zur Bearbeitung der Anmeldung verwendet werden.<br>
          عند الإرسال أنتم توافقون على استخدام البيانات لأغراض التسجيل فقط.
        </div>
      </div>
    </div>
  `;
}

function renderPdfHtml(data) {
  const scheduleLines = buildScheduleLines(data);
  const scheduleHtml = scheduleLines.length
    ? scheduleLines
        .map((line) => `<div class="value-line rtl-value">${escapeHtml(line)}</div>`)
        .join("")
    : `<div class="value-line">-</div>`;

  const guardianSignatureHtml = data.guardianSignatureData
    ? `<img src="${data.guardianSignatureData}" alt="Guardian Signature">`
    : `<div class="signature-empty">Keine Unterschrift / لا يوجد توقيع</div>`;

  const teacherSignatureHtml = data.teacherSignatureData
    ? `<img src="${data.teacherSignatureData}" alt="Teacher Signature">`
    : `<div class="signature-empty">Wird von der Akademie ausgefüllt / يُستكمل من قبل الأكاديمية</div>`;

  return `
<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Iqraa Akademie Anmeldung</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Nunito", Arial, sans-serif;
      color: #1f2b3a;
      background:
        radial-gradient(circle at 10% 8%, rgba(245,123,174,0.08), transparent 22%),
        radial-gradient(circle at 88% 10%, rgba(102,176,233,0.08), transparent 22%),
        #f7fbff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-wrap {
      width: 100%;
      padding: 0;
      background: transparent;
    }

    .doc-shell {
      background: #ffffff;
      border-radius: 26px;
      overflow: hidden;
      border: 1px solid rgba(31,43,58,0.05);
      box-shadow:
        0 10px 28px rgba(31,43,58,0.05),
        0 2px 8px rgba(102,176,233,0.08);
    }

    .top-hero {
      background:
        radial-gradient(circle at 16% 18%, rgba(255,255,255,0.18), transparent 22%),
        radial-gradient(circle at 84% 14%, rgba(255,255,255,0.16), transparent 22%),
        linear-gradient(135deg, #f57bae, #66b0e9);
      color: #fff;
      padding: 28px 26px 24px;
      text-align: center;
      position: relative;
    }

    .top-hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0));
      pointer-events: none;
    }

    .logo {
      width: 112px;
      height: auto;
      display: block;
      margin: 0 auto 10px;
      position: relative;
      z-index: 1;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,0.08));
    }

    .title-de {
      margin: 0;
      font-size: 27px;
      font-weight: 900;
      position: relative;
      z-index: 1;
      line-height: 1.2;
      letter-spacing: 0.2px;
    }

    .title-ar {
      margin: 7px 0 0;
      font-size: 20px;
      font-family: "Cairo", Arial, sans-serif;
      font-weight: 700;
      position: relative;
      z-index: 1;
      direction: rtl;
      line-height: 1.5;
    }

    .hero-mini {
      margin-top: 10px;
      font-size: 13px;
      opacity: 0.98;
      position: relative;
      z-index: 1;
      line-height: 1.8;
    }

    .summary-bar {
      padding: 12px 16px 0;
    }

    .summary-card {
      background: linear-gradient(135deg, rgba(245,123,174,0.08), rgba(102,176,233,0.10));
      border: 1px solid rgba(31,43,58,0.05);
      border-radius: 18px;
      padding: 14px 16px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .summary-item {
      background: rgba(255,255,255,0.86);
      border-radius: 14px;
      padding: 10px 12px;
      text-align: center;
      border: 1px solid rgba(31,43,58,0.05);
    }

    .summary-label {
      font-size: 10.5px;
      font-weight: 900;
      color: #7c4269;
      margin-bottom: 4px;
      line-height: 1.45;
    }

    .summary-value {
      font-size: 13px;
      font-weight: 800;
      color: #24314f;
      line-height: 1.55;
      word-break: break-word;
    }

    .section {
      padding: 16px 16px 0;
    }

    .intro-card {
      background: linear-gradient(135deg, rgba(245,123,174,0.08), rgba(102,176,233,0.08));
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid rgba(31,43,58,0.05);
    }

    .intro-card .intro-de {
      margin: 0 0 5px;
      font-weight: 800;
      color: #23314e;
      text-align: center;
      font-size: 13px;
      line-height: 1.65;
    }

    .intro-card .intro-ar {
      margin: 0;
      font-family: "Cairo", Arial, sans-serif;
      direction: rtl;
      text-align: center;
      color: #7f4166;
      font-weight: 700;
      line-height: 1.95;
      font-size: 13px;
    }

    .section-title-row {
      padding: 14px 16px 0;
      break-after: avoid;
      page-break-after: avoid;
    }

    .section-title {
      margin: 0;
      padding: 12px 16px;
      border-radius: 18px;
      background:
        linear-gradient(135deg, rgba(245,123,174,0.12), rgba(102,176,233,0.12)),
        #ffffff;
      color: #23314e;
      text-align: center;
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 0.25px;
      border: 1px solid rgba(31,43,58,0.05);
    }

    .section-title .ar {
      display: block;
      margin-top: 3px;
      font-family: "Cairo", Arial, sans-serif;
      color: #8d4370;
      direction: rtl;
      font-size: 15px;
      font-weight: 700;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 12px 16px 0;
    }

    .card {
      background: linear-gradient(180deg, #ffffff, #fcfdff);
      border-radius: 16px;
      border: 1px solid rgba(31,43,58,0.06);
      box-shadow: 0 4px 14px rgba(31,43,58,0.03);
      padding: 12px 12px 11px;
      min-height: 100%;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .card.full {
      grid-column: 1 / -1;
    }

    .label-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 8px;
      align-items: start;
    }

    .label-de {
      display: block;
      font-size: 11px;
      font-weight: 900;
      color: #24314f;
      line-height: 1.45;
    }

    .label-ar {
      display: block;
      font-size: 11px;
      font-family: "Cairo", Arial, sans-serif;
      color: #b24e84;
      direction: rtl;
      text-align: right;
      font-weight: 700;
      line-height: 1.7;
    }

    .value,
    .value-line {
      font-size: 13px;
      color: #334055;
      line-height: 1.75;
      word-break: break-word;
      background: #f8fbff;
      border: 1px solid rgba(31,43,58,0.04);
      border-radius: 12px;
      padding: 9px 11px;
    }

    .rtl-value {
      font-family: "Cairo", Arial, sans-serif;
      direction: rtl;
      text-align: right;
      line-height: 2;
    }

    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 12px;
      line-height: 1.35;
    }

    .status-yes {
      background: #e8f7ee;
      color: #1f8f4d;
      border: 1px solid rgba(31,143,77,0.15);
    }

    .status-no {
      background: #f2f4f7;
      color: #6b7280;
      border: 1px solid rgba(107,114,128,0.14);
    }

    .value-dash {
      color: #7b8796;
      font-size: 13px;
      font-weight: 700;
    }

    .policy-wrap {
      padding: 12px 16px 0;
    }

    .policy-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .policy-column {
      background: linear-gradient(180deg, #ffffff, #fcfdff);
      border-radius: 16px;
      border: 1px solid rgba(31,43,58,0.06);
      box-shadow: 0 4px 14px rgba(31,43,58,0.03);
      padding: 14px 15px;
    }

    .policy-subhead {
      font-size: 12px;
      font-weight: 900;
      color: #24314f;
      margin-bottom: 8px;
      line-height: 1.45;
    }

    .rtl-head {
      font-family: "Cairo", Arial, sans-serif;
      direction: rtl;
      text-align: right;
      color: #8d4370;
    }

    .policy-list {
      margin: 0;
      padding-left: 18px;
      font-size: 11.5px;
      line-height: 1.85;
      color: #425168;
    }

    .policy-list li {
      margin-bottom: 5px;
    }

    .arabic-list {
      padding-left: 0;
      padding-right: 18px;
      direction: rtl;
      text-align: right;
      font-family: "Cairo", Arial, sans-serif;
      line-height: 2;
      color: #425168;
    }

    .privacy-box {
      background: linear-gradient(135deg, rgba(245,123,174,0.10), rgba(102,176,233,0.10));
      border-radius: 16px;
      border: 1px solid rgba(31,43,58,0.05);
      padding: 13px 15px;
      margin-top: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .privacy-title {
      font-size: 12px;
      font-weight: 900;
      color: #24314f;
      margin-bottom: 6px;
    }

    .privacy-text {
      font-size: 11.5px;
      line-height: 1.9;
      color: #425168;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 12px 16px 14px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .signature-card {
      background: linear-gradient(180deg, #ffffff, #fcfdff);
      border-radius: 16px;
      border: 1px solid rgba(31,43,58,0.06);
      box-shadow: 0 4px 14px rgba(31,43,58,0.03);
      padding: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .signature-box {
      margin-top: 8px;
      height: 118px;
      border: 1px dashed rgba(31,43,58,0.16);
      border-radius: 13px;
      background: #f8fbff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .signature-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }

    .signature-empty {
      color: #7c8898;
      font-size: 12px;
      text-align: center;
      padding: 12px;
      font-family: "Cairo", Arial, sans-serif;
      line-height: 1.8;
    }

    .footer {
      padding: 0 16px 16px;
      margin-top: 4px;
    }

    .footer-card {
      background: linear-gradient(135deg, rgba(245,123,174,0.08), rgba(102,176,233,0.08));
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid rgba(31,43,58,0.05);
      text-align: center;
    }

    .footer-title {
      margin: 0 0 5px;
      font-size: 13px;
      font-weight: 900;
      color: #24314f;
    }

    .footer-text {
      margin: 0;
      font-size: 11.5px;
      line-height: 1.8;
      color: #4a5a70;
    }

    @page {
      size: A4;
      margin: 8mm;
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="doc-shell">
      <div class="top-hero">
        <img src="${LOGO_URL}" alt="Iqraa Akademie Logo" class="logo">
        <h1 class="title-de">Anmeldung der Iqraa Akademie</h1>
        <div class="title-ar">استمارة التسجيل في أكاديمية اقرأ</div>
        <div class="hero-mini">
          Kinderfreundlicher Arabischunterricht in Bocholt<br>
          تسجيل ثنائي اللغة لدورات تعليم العربية للأطفال في بوخولت
        </div>
      </div>

      <div class="summary-bar">
        <div class="summary-card">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Kind / الطفل</div>
              <div class="summary-value">${escapeHtml(data.studentName)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Kurs / الدورة</div>
              <div class="summary-value">${escapeHtml(data.level)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Datum / التاريخ</div>
              <div class="summary-value">${escapeHtml(data.registrationDate)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="intro-card">
          <p class="intro-de">Vielen Dank für Ihre Anmeldung. Nachfolgend finden Sie die übermittelten Registrierungsdaten in übersichtlicher Form.</p>
          <p class="intro-ar">شكراً لكم على التسجيل. فيما يلي تجدون بيانات الاستمارة المرسلة بشكل منظم وواضح.</p>
        </div>
      </div>

      <div class="section-title-row">
        <h2 class="section-title">
          Persönliche Angaben
          <span class="ar">البيانات الشخصية</span>
        </h2>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label-row">
            <span class="label-de">Name des Kindes</span>
            <span class="label-ar">اسم الطفل</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.studentName)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Geburtsdatum</span>
            <span class="label-ar">تاريخ الميلاد</span>
          </div>
          <div class="value">${escapeHtml(data.birthDate)}</div>
        </div>

        <div class="card full">
          <div class="label-row">
            <span class="label-de">Wohnadresse</span>
            <span class="label-ar">عنوان السكن</span>
          </div>
          <div class="value">${escapeHtml(data.address)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Name des Erziehungsberechtigten</span>
            <span class="label-ar">اسم ولي الأمر</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.guardianName)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Telefonnummer</span>
            <span class="label-ar">رقم الهاتف</span>
          </div>
          <div class="value">${escapeHtml(data.phone)}</div>
        </div>

        <div class="card full">
          <div class="label-row">
            <span class="label-de">E-Mail der Eltern</span>
            <span class="label-ar">البريد الإلكتروني لولي الأمر</span>
          </div>
          <div class="value">${escapeHtml(data.guardianEmail)}</div>
        </div>

        <div class="card full">
          <div class="label-row">
            <span class="label-de">Zu Hause gesprochene Sprachen</span>
            <span class="label-ar">اللغات المستخدمة في المنزل</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.homeLanguages)}</div>
        </div>
      </div>

      <div class="section-title-row">
        <h2 class="section-title">
          Kursangaben
          <span class="ar">بيانات الدورة</span>
        </h2>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label-row">
            <span class="label-de">Kursniveau</span>
            <span class="label-ar">مستوى الدورة</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.level)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Geschlecht</span>
            <span class="label-ar">الجنس</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.gender)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Vorherige Arabischkenntnisse</span>
            <span class="label-ar">هل لدى الطفل معرفة سابقة باللغة العربية؟</span>
          </div>
          <div class="value">${boolBadge(data.knowsArabic)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Einverständnis für Fotos / Videos</span>
            <span class="label-ar">الموافقة على الصور والفيديو</span>
          </div>
          <div class="value">${boolBadge(data.mediaConsent)}</div>
        </div>

        <div class="card full">
          <div class="label-row">
            <span class="label-de">Zeitplan</span>
            <span class="label-ar">الجدول الزمني</span>
          </div>
          <div class="value">${scheduleHtml}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Kursbeginn</span>
            <span class="label-ar">تاريخ بدء الدورة</span>
          </div>
          <div class="value">${escapeHtml(data.startDate)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Monatliche Gebühr</span>
            <span class="label-ar">الرسوم الشهرية</span>
          </div>
          <div class="value"><strong>40 €</strong></div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Bevorzugte Zahlungsart</span>
            <span class="label-ar">طريقة الدفع المفضلة</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.paymentMethod)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Anmeldedatum</span>
            <span class="label-ar">تاريخ التسجيل</span>
          </div>
          <div class="value">${escapeHtml(data.registrationDate)}</div>
        </div>
      </div>

      <div class="section-title-row">
        <h2 class="section-title">
          Gesundheit und Hinweise
          <span class="ar">الصحة والملاحظات</span>
        </h2>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label-row">
            <span class="label-de">Chronische Erkrankungen</span>
            <span class="label-ar">الأمراض المزمنة</span>
          </div>
          <div class="value">${boolBadge(data.chronicIllness)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Details zu chronischen Erkrankungen</span>
            <span class="label-ar">تفاصيل المرض المزمن</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.chronicDetails)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Allergien</span>
            <span class="label-ar">الحساسية</span>
          </div>
          <div class="value">${boolBadge(data.allergy)}</div>
        </div>

        <div class="card">
          <div class="label-row">
            <span class="label-de">Details zu Allergien</span>
            <span class="label-ar">تفاصيل الحساسية</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.allergyDetails)}</div>
        </div>

        <div class="card full">
          <div class="label-row">
            <span class="label-de">Einverständnis mit Regeln und Richtlinien</span>
            <span class="label-ar">الموافقة على القوانين والسياسات</span>
          </div>
          <div class="value">${boolBadge(data.policyConsent)}</div>
        </div>

        <div class="card full">
          <div class="label-row">
            <span class="label-de">Zusätzliche Notizen der Eltern</span>
            <span class="label-ar">ملاحظات إضافية من ولي الأمر</span>
          </div>
          <div class="value rtl-value">${escapeHtml(data.parentNotes)}</div>
        </div>
      </div>

      <div class="section-title-row">
        <h2 class="section-title">
          Regeln und Richtlinien
          <span class="ar">القوانين والسياسات</span>
        </h2>
      </div>

      ${renderPoliciesHtml()}

      <div class="section-title-row">
        <h2 class="section-title">
          Unterschriften
          <span class="ar">التوقيعات</span>
        </h2>
      </div>

      <div class="signature-grid">
        <div class="signature-card">
          <div class="label-row">
            <span class="label-de">Unterschrift Erziehungsberechtigter</span>
            <span class="label-ar">توقيع ولي الأمر</span>
          </div>
          <div class="signature-box">
            ${guardianSignatureHtml}
          </div>
        </div>

        <div class="signature-card">
          <div class="label-row">
            <span class="label-de">Unterschrift Lehrerin</span>
            <span class="label-ar">توقيع المعلمة</span>
          </div>
          <div class="signature-box">
            ${teacherSignatureHtml}
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-card">
          <div class="footer-title">Iqraa Akademie / أكاديمية اقرأ</div>
          <p class="footer-text">
            Dinxperloer Strasse 92, 46399 Bocholt<br>
            kontakt@iqraa-akademie.de
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

async function buildPdfBuffer(formData) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const html = renderPdfHtml(formData);

    await page.setViewport({ width: 1240, height: 1754 });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "IQRAA backend is running.",
  });
});

app.post("/api/register", registerLimiter, async (req, res) => {
  try {
    const data = sanitizeFormData(req.body || {});
    const validationError = validateFormData(data);

    if (validationError) {
      return res.status(400).json({
        ok: false,
        message: validationError,
      });
    }

    const pdfBuffer = await buildPdfBuffer(data);
    const transporter = createTransporter();

    const safeStudentName = (data.studentName || "kind")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO || process.env.SMTP_USER,
      replyTo: data.guardianEmail,
      subject: `Neue Anmeldung - ${safeValue(data.studentName)} / تسجيل جديد`,
      text: buildAcademyText(data),
      html: buildAcademyHtml(data),
      attachments: [
        {
          filename: `iqraa-anmeldung-${safeStudentName || "kind"}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: data.guardianEmail,
      subject: "Ihre Anmeldung bei der Iqraa Akademie / تأكيد التسجيل",
      text: buildParentText(data),
      html: buildParentHtml(data),
    });

    return res.json({
      ok: true,
      message: "Registration submitted successfully.",
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      ok: false,
      message: "Email/PDF could not be sent yet. Please check backend setup.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`IQRAA backend running on port ${PORT}`);
});