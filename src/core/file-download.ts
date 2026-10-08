// Standard browser downloads work without a platform-specific filesystem API.
export async function downloadText(
  filename: string,
  text: string,
  type = 'text/plain;charset=utf-8',
  options: { deferPaint?: boolean } = {},
): Promise<void> {
  // For browser backups, preserve the immediate click gesture for mobile/Safari.
  if (options.deferPaint !== false) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
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
