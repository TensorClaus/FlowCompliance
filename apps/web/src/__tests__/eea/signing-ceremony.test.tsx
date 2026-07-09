import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { EEA2SigningCeremonyPage } from '@/features/eea/components/eea2-signing-ceremony'
import { server } from '@/test/server'

const FORM_ID = '11111111-1111-4111-8111-111111111111'

async function fillCeremony(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('TOTP code'), '123456')
  await user.type(screen.getByPlaceholderText('Type your full registered name exactly'), 'S Nkosi')
  await user.click(screen.getByTestId('declaration-checkbox'))
}

describe('EEA2SigningCeremonyPage', () => {
  it('keeps the sign button disabled until TOTP, name, and declaration are all provided', async () => {
    const user = userEvent.setup()
    render(<EEA2SigningCeremonyPage formId={FORM_ID} signRequest={vi.fn()} />)

    const signButton = screen.getByRole('button', { name: 'Confirm and Sign' })
    expect(signButton).toBeDisabled()

    await user.type(screen.getByLabelText('TOTP code'), '123456')
    expect(signButton).toBeDisabled()

    await user.type(
      screen.getByPlaceholderText('Type your full registered name exactly'),
      'S Nkosi',
    )
    expect(signButton).toBeDisabled()

    await user.click(screen.getByTestId('declaration-checkbox'))
    expect(signButton).toBeEnabled()
  })

  it('strips non-digits from the TOTP input and caps it at 6 digits', async () => {
    const user = userEvent.setup()
    render(<EEA2SigningCeremonyPage formId={FORM_ID} signRequest={vi.fn()} />)

    const totpInput = screen.getByLabelText('TOTP code')
    await user.type(totpInput, 'a1b2c3d4e5f6g7')
    expect(totpInput).toHaveValue('123456')
  })

  it('navigates to the locked view after a successful signing', async () => {
    const user = userEvent.setup()
    const signRequest = vi.fn().mockResolvedValue({ status: 'signed' as const })
    const navigateToLockedView = vi.fn()
    render(
      <EEA2SigningCeremonyPage
        formId={FORM_ID}
        navigateToLockedView={navigateToLockedView}
        signRequest={signRequest}
      />,
    )

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    await waitFor(() => {
      expect(navigateToLockedView).toHaveBeenCalledWith(FORM_ID)
    })
    expect(signRequest).toHaveBeenCalledWith({
      formId: FORM_ID,
      totpCode: '123456',
      typedName: 'S Nkosi',
      confirmationChecked: true,
    })
  })

  it.each([
    ['Invalid TOTP code', 'totp-error'],
    ['TOTP not configured', 'totp-error'],
    ['Name does not match', 'typed-name-error'],
  ])('routes the "%s" failure to the %s field', async (message, errorId) => {
    const user = userEvent.setup()
    const signRequest = vi.fn().mockRejectedValue(new Error(message))
    render(
      <EEA2SigningCeremonyPage
        formId={FORM_ID}
        navigateToLockedView={vi.fn()}
        signRequest={signRequest}
      />,
    )

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    const errorElement = await screen.findByText(message)
    expect(errorElement).toHaveAttribute('id', errorId)
  })

  it('maps the immutability failure to a friendly form-level message', async () => {
    const user = userEvent.setup()
    const signRequest = vi.fn().mockRejectedValue(new Error('Form is immutable'))
    render(
      <EEA2SigningCeremonyPage
        formId={FORM_ID}
        navigateToLockedView={vi.fn()}
        signRequest={signRequest}
      />,
    )

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    expect(await screen.findByText('This form has already been signed.')).toBeInTheDocument()
  })

  it('shows a generic message when the failure is not an Error instance', async () => {
    const user = userEvent.setup()

    const signRequest = vi.fn().mockRejectedValue('boom')
    render(
      <EEA2SigningCeremonyPage
        formId={FORM_ID}
        navigateToLockedView={vi.fn()}
        signRequest={signRequest}
      />,
    )

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    expect(await screen.findByText('Unable to sign this form.')).toBeInTheDocument()
  })

  it('default sign request POSTs to the sign endpoint and surfaces the API error body', async () => {
    server.use(
      http.post(`/api/eea2/${FORM_ID}/sign`, () =>
        HttpResponse.json({ error: 'Invalid TOTP code' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    render(<EEA2SigningCeremonyPage formId={FORM_ID} navigateToLockedView={vi.fn()} />)

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    expect(await screen.findByText('Invalid TOTP code')).toBeInTheDocument()
  })

  it('default sign request falls back to SIGN_<status> when the error body is not JSON', async () => {
    server.use(
      http.post(`/api/eea2/${FORM_ID}/sign`, () => new HttpResponse('gateway', { status: 502 })),
    )
    const user = userEvent.setup()
    render(<EEA2SigningCeremonyPage formId={FORM_ID} navigateToLockedView={vi.fn()} />)

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    expect(await screen.findByText('SIGN_502')).toBeInTheDocument()
  })

  it('default sign request resolves and navigates on a 200 response', async () => {
    server.use(
      http.post(`/api/eea2/${FORM_ID}/sign`, () => HttpResponse.json({ status: 'signed' })),
    )
    const user = userEvent.setup()
    const navigateToLockedView = vi.fn()
    render(<EEA2SigningCeremonyPage formId={FORM_ID} navigateToLockedView={navigateToLockedView} />)

    await fillCeremony(user)
    await user.click(screen.getByRole('button', { name: 'Confirm and Sign' }))

    await waitFor(() => {
      expect(navigateToLockedView).toHaveBeenCalledWith(FORM_ID)
    })
  })
})
