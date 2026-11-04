export type ResetCredentials = { identifyCode: string; token: string };

// App links require a public HTTPS origin, not a server path or URL carrying credentials.
export function resetLinkOrigin(value: string | undefined): string | null {
  try {
    if (!value || value !== value.trim()) return null;
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resetCredentials(params: {
  identifyCode?: unknown;
  token?: unknown;
}): ResetCredentials | null {
  const { identifyCode, token } = params;
  // Reject arrays from duplicate route parameters instead of picking one value.
  if (
    typeof identifyCode !== 'string' ||
    !/^[A-Za-z0-9]{6}$/.test(identifyCode) ||
    typeof token !== 'string' ||
    !/^[0-9a-z]{1,13}-[0-9a-f]{32}$/.test(token)
  )
    return null;
  return { identifyCode, token };
}
