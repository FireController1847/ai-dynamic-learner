// Standard browser downloads work without a platform-specific filesystem API.
export async function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  // Give the initiating button a chance to paint its busy state before preparing the file.
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Leave mobile browsers time to consume the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
