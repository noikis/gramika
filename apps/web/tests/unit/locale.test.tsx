import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LocaleProvider, useLocale } from '../../src/hooks/use-locale'
import { LOCALE_STORAGE_KEY, Locale } from '../../src/i18n'

function LocaleProbe() {
  const { locale, setLocale, t } = useLocale()
  return (
    <div>
      <output>{locale}</output>
      <p>{t('correction')}</p>
      <button type="button" onClick={() => setLocale(Locale.Russian)}>
        Русский
      </button>
    </div>
  )
}

describe('locale persistence', () => {
  it('loads and persists an explicit locale while updating document language', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, Locale.French)
    const user = userEvent.setup()
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    )

    expect(screen.getByText(Locale.French)).toBeTruthy()
    expect(document.documentElement.lang).toBe(Locale.French)
    await user.click(screen.getByRole('button', { name: 'Русский' }))
    expect(screen.getByText(Locale.Russian)).toBeTruthy()
    expect(document.documentElement.lang).toBe(Locale.Russian)
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(Locale.Russian)
  })
})
