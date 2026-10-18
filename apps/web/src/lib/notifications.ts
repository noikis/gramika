import { toast } from 'sonner'

export function notify(message: string, success = false) {
  toast(message, { id: 'action-feedback', duration: success ? 2000 : 5000 })
}
