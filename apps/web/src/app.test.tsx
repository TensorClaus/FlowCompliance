import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import App from './App'
import { cn } from './lib/utils'
import { router } from './router'

describe('web app bootstrap', () => {
  it('App root component returns null placeholder', () => {
    const { container } = render(<App />)
    expect(container).toBeEmptyDOMElement()
  })

  it('cn merges Tailwind utility classes deterministically', () => {
    expect(cn('px-2', 'text-sm', 'px-4')).toBe('text-sm px-4')
  })

  it('router index route renders EEA wizard shell', async () => {
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'EEA Wizard' })).toBeInTheDocument()
  })
})
