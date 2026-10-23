// Web-only export. This module is excluded from the offline mini-tool build.
export const canSaveArtwork = () => true;
export const savedLabel = '已导出图片';
export async function saveArtwork(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl; link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); }
}

// Downloads own their URL briefly, independently of the preview, so closing
// the dialog immediately cannot revoke a file the browser is still reading.
const videoDownloads = new Map();
function releaseDownload(url) {
  clearTimeout(videoDownloads.get(url)); videoDownloads.delete(url);
  URL.revokeObjectURL(url);
}
window.addEventListener('pagehide', () => {
  for (const url of videoDownloads.keys()) releaseDownload(url);
});
export async function saveVideo(blob, filename) {
  const url = URL.createObjectURL(blob);
  try { await saveArtwork(url, filename); }
  catch (error) { releaseDownload(url); throw error; }
  videoDownloads.set(url, setTimeout(() => releaseDownload(url), 30000));
}
