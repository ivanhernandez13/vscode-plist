export async function sha256(str: string): Promise<string> {
  const uint8Array = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', uint8Array);
  return new TextDecoder().decode(digest);
}
