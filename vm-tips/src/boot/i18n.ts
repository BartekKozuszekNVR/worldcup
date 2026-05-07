import { boot } from 'quasar/wrappers'
import { createI18n } from 'vue-i18n'
import messages from '../i18n'

export type MessageSchema = typeof messages.sv

const i18n = createI18n<[MessageSchema], 'sv' | 'en'>({
  locale: 'sv',
  fallbackLocale: 'en',
  legacy: false,
  messages,
})

export default boot(({ app }) => {
  app.use(i18n)
})

export { i18n }
