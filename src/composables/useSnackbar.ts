import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
const color = ref<'success' | 'error' | 'info' | 'warning'>('success')
const timeout = ref(4000)

export function useSnackbar() {
  function showSuccess(msg: string) {
    message.value = msg
    color.value = 'success'
    visible.value = true
  }

  function showError(msg: string) {
    message.value = msg
    color.value = 'error'
    visible.value = true
  }

  function showInfo(msg: string) {
    message.value = msg
    color.value = 'info'
    visible.value = true
  }

  function showWarning(msg: string) {
    message.value = msg
    color.value = 'warning'
    visible.value = true
  }

  function hide() {
    visible.value = false
  }

  return { visible, message, color, timeout, showSuccess, showError, showInfo, showWarning, hide }
}
