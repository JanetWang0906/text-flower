// Web-only export. This module is excluded from the offline mini-tool build.
export const canSaveArtwork = () => true;
export const savedLabel = '已导出图片';
export async function saveArtwork(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
}
