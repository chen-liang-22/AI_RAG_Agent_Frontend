import { ElMessage } from 'element-plus'

export function openHttpFilePreview(fileUrl: string | null | undefined, fallbackMessage = '文件预览地址为空') {
  const cleanUrl = String(fileUrl || '').trim()
  if (!cleanUrl) {
    ElMessage.warning(fallbackMessage)
    return false
  }

  // 先打开空白页再跳转，可以避免部分浏览器因为 noopener 返回 null 而误判为弹窗拦截。
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    ElMessage.warning('浏览器拦截了预览窗口，请允许弹窗后重试')
    return false
  }
  previewWindow.opener = null
  previewWindow.location.href = cleanUrl
  return true
}
