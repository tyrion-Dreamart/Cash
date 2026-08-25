import { authHeaders } from "./auth"

// Downloads a file from an authenticated endpoint. Plain <a href> / window.open
// navigations can't carry the Authorization header, so the backend would just
// reject them (401/403) now that every endpoint requires a token.
export async function downloadFile(url: string, fallbackFilename = "download.xlsx") {
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error("Error " + res.status)
  const blob = await res.blob()
  const disposition = res.headers.get("Content-Disposition") || ""
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : fallbackFilename

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}
