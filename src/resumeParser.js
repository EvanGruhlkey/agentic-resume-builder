import mammoth from "mammoth";

export async function extractResumeInput({ typedText, file }) {
  if (typedText && typedText.trim().length >= 80) {
    return {
      text: cleanResumeText(typedText),
      source: "pasted text"
    };
  }

  if (!file) {
    return { text: "", source: "empty" };
  }

  const filename = file.originalname || "uploaded resume";
  const extension = filename.toLowerCase().split(".").pop();

  if (extension === "pdf" || file.mimetype === "application/pdf") {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(file.buffer);
    return {
      text: cleanResumeText(parsed.text || ""),
      source: filename
    };
  }

  if (
    extension === "docx" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return {
      text: cleanResumeText(parsed.value || ""),
      source: filename
    };
  }

  if (["txt", "md", "rtf"].includes(extension) || file.mimetype.startsWith("text/")) {
    return {
      text: cleanResumeText(file.buffer.toString("utf8")),
      source: filename
    };
  }

  return {
    text: "",
    source: `${filename} (unsupported file type)`
  };
}

function cleanResumeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
