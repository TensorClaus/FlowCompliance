import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NationalitySection } from '@/components/eea1/NationalitySection'
import { PersonalDetailsSection } from '@/components/eea1/PersonalDetailsSection'
import { SignatureStep } from '@/components/eea1/SignatureStep'
import { useWizardFormController } from '@/features/eea/wizard-form-context'
import { installCanvasMock, MOCK_SIGNATURE_DATA_URL } from '@/test/canvas-mock'
import { server } from '@/test/server'

const FORM_ID = '11111111-1111-4111-8111-111111111111'
const EMPLOYEE_ID = '22222222-2222-4222-8222-222222222222'

beforeAll(() => {
  installCanvasMock()
})

describe('PersonalDetailsSection', () => {
  it('renders the employee ID as a read-only field', () => {
    render(<PersonalDetailsSection employeeId={EMPLOYEE_ID} formId={FORM_ID} />)

    const idInput = screen.getByTestId('personal-employee-id')
    expect(idInput).toHaveValue(EMPLOYEE_ID)
    expect(idInput).toHaveAttribute('readonly')
  })

  it('shows a validation error on blur for a too-short name and clears it on fix', async () => {
    server.use(http.patch(`/eea1/${FORM_ID}`, () => new HttpResponse(null, { status: 200 })))
    const user = userEvent.setup()
    render(<PersonalDetailsSection employeeId={EMPLOYEE_ID} formId={FORM_ID} />)

    const nameInput = screen.getByTestId('personal-name')
    await user.type(nameInput, 'T')
    fireEvent.blur(nameInput)

    expect(screen.getByTestId('personal-name-error')).toBeInTheDocument()
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')

    await user.type(nameInput, 'handi Mokoena')
    fireEvent.blur(nameInput)

    expect(screen.queryByTestId('personal-name-error')).not.toBeInTheDocument()
    expect(nameInput).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows a validation error on blur for an empty workplace number', async () => {
    server.use(http.patch(`/eea1/${FORM_ID}`, () => new HttpResponse(null, { status: 200 })))
    const user = userEvent.setup()
    render(<PersonalDetailsSection employeeId={EMPLOYEE_ID} formId={FORM_ID} />)

    const workplaceInput = screen.getByTestId('personal-workplace-number')
    fireEvent.blur(workplaceInput)
    expect(screen.getByTestId('personal-workplace-number-error')).toBeInTheDocument()

    await user.type(workplaceInput, 'WP-042')
    fireEvent.blur(workplaceInput)
    expect(screen.queryByTestId('personal-workplace-number-error')).not.toBeInTheDocument()
  })
})

function drawStroke(canvas: HTMLElement): void {
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 30 })
  fireEvent.pointerUp(canvas, { pointerId: 1 })
}

describe('SignatureStep', () => {
  it('renders the statutory declaration verbatim (EEA 55/1998)', () => {
    render(<SignatureStep formId={FORM_ID} onSubmit={vi.fn()} />)

    expect(screen.getByTestId('statutory-declaration')).toHaveTextContent(
      'I declare that the information furnished on this form is true and correct and that I am ' +
        'aware that furnishing false information is a contravention of the Employment Equity ' +
        'Act 55 of 1998.',
    )
  })

  it('renders a read-only declaration date', () => {
    render(<SignatureStep formId={FORM_ID} onSubmit={vi.fn()} />)

    const dateInput = screen.getByTestId('declaration-date')
    expect(dateInput).toHaveAttribute('readonly')
    expect((dateInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('disables submit until ink is present on the canvas', () => {
    const onSubmit = vi.fn()
    render(<SignatureStep formId={FORM_ID} onSubmit={onSubmit} />)

    const submit = screen.getByTestId('signature-submit')
    expect(submit).toBeDisabled()

    drawStroke(screen.getByTestId('signature-canvas'))
    expect(submit).toBeEnabled()
  })

  it('passes the canvas data URL to onSubmit — never to browser storage', () => {
    const onSubmit = vi.fn()
    render(<SignatureStep formId={FORM_ID} onSubmit={onSubmit} />)

    drawStroke(screen.getByTestId('signature-canvas'))
    fireEvent.click(screen.getByTestId('signature-submit'))

    expect(onSubmit).toHaveBeenCalledWith(MOCK_SIGNATURE_DATA_URL)
    expect(globalThis.localStorage.length).toBe(0)
  })

  it('clear wipes the ink and disables submit again', () => {
    const onSubmit = vi.fn()
    render(<SignatureStep formId={FORM_ID} onSubmit={onSubmit} />)

    drawStroke(screen.getByTestId('signature-canvas'))
    expect(screen.getByTestId('signature-submit')).toBeEnabled()

    fireEvent.click(screen.getByTestId('signature-clear'))
    expect(screen.getByTestId('signature-submit')).toBeDisabled()

    fireEvent.click(screen.getByTestId('signature-submit'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ignores pointer moves that occur without a pointer-down', () => {
    const onSubmit = vi.fn()
    render(<SignatureStep formId={FORM_ID} onSubmit={onSubmit} />)

    fireEvent.pointerMove(screen.getByTestId('signature-canvas'), {
      pointerId: 1,
      clientX: 40,
      clientY: 30,
    })

    expect(screen.getByTestId('signature-submit')).toBeDisabled()
  })
})

describe('NationalitySection', () => {
  it('renders the citizenship date only for foreign nationals — absent from the DOM otherwise', async () => {
    server.use(http.patch(`/eea1/${FORM_ID}`, () => new HttpResponse(null, { status: 200 })))
    const user = userEvent.setup()
    render(<NationalitySection formId={FORM_ID} />)

    expect(screen.queryByTestId('citizenship-date-wrapper')).not.toBeInTheDocument()
    expect(screen.getByTestId('nationality-statutory-note')).toBeInTheDocument()

    await user.click(screen.getByTestId('nationality-foreign-national'))
    expect(screen.getByTestId('citizenship-date-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('nationality-statutory-note')).toBeInTheDocument()
  })

  it('clears the citizenship date and its error when switching back to SA citizen', async () => {
    server.use(http.patch(`/eea1/${FORM_ID}`, () => new HttpResponse(null, { status: 200 })))
    const user = userEvent.setup()
    render(
      <NationalitySection
        formId={FORM_ID}
        initialCitizenshipDate="2019-06-30"
        initialForeignNational={true}
      />,
    )

    expect(screen.getByTestId('citizenship-date')).toHaveValue('2019-06-30')

    await user.click(screen.getByTestId('nationality-sa-citizen'))
    expect(screen.queryByTestId('citizenship-date-wrapper')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('nationality-foreign-national'))
    expect(screen.getByTestId('citizenship-date')).toHaveValue('')
    expect(screen.queryByTestId('citizenship-date-error')).not.toBeInTheDocument()
  })

  it('accepts a valid citizenship date and flags clearing it back to empty', () => {
    server.use(http.patch(`/eea1/${FORM_ID}`, () => new HttpResponse(null, { status: 200 })))
    render(<NationalitySection formId={FORM_ID} initialForeignNational={true} />)

    const dateInput = screen.getByTestId('citizenship-date')
    fireEvent.change(dateInput, { target: { value: '2019-06-30' } })
    expect(screen.queryByTestId('citizenship-date-error')).not.toBeInTheDocument()

    fireEvent.change(dateInput, { target: { value: '' } })
    expect(screen.getByTestId('citizenship-date-error')).toBeInTheDocument()
    expect(dateInput).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('useWizardFormController', () => {
  it('throws when a step renders outside EEAWizard', () => {
    expect(() => renderHook(() => useWizardFormController())).toThrow(
      'Wizard steps must be rendered inside EEAWizard',
    )
  })
})
