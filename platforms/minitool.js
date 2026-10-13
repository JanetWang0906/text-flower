// Native album adapter. The offline package contains no browser download path.
export const canSaveArtwork = () => !!(window.xhs && window.xhs.miniTool && typeof window.xhs.miniTool.saveImageToPhotosAlbum === 'function');
export const savedLabel = '已保存到相册';
export async function saveArtwork(dataUrl) {
  const sdk = window.xhs && window.xhs.miniTool;
  if (!canSaveArtwork()) throw new Error('当前环境不支持保存图片');
  let filePath = dataUrl;
  if (typeof sdk.writeTempFile === 'function') filePath = (await sdk.writeTempFile({ data: dataUrl })).filePath;
  await sdk.saveImageToPhotosAlbum({ filePath });
}
