// The API sanitizes the body; CSP also blocks scripts and remote resources in the viewer.
export function noticeDocument(body: string) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: #181818; }
  body {
    padding: 0 20px 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
  h1, h2, h3 { line-height: 1.4; }
  p { margin: 0 0 16px; }
  a { color: #ff5656; }
  pre { white-space: pre-wrap; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { border: 1px solid #aaa; padding: 8px; }
  blockquote { margin-left: 0; padding-left: 16px; border-left: 3px solid #aaa; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function noticeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return !url.username && !url.password && ['https:', 'mailto:'].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
