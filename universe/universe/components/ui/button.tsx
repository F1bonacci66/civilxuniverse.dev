import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline'
}

const baseClasses =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed h-12 px-8 py-3'

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-primary-gradient text-black hover:bg-primary-gradient-hover shadow-[0_4px_15px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)] hover:-translate-y-[3px] active:translate-y-[-1px] shine-effect',
  outline:
    'border border-white/20 bg-transparent text-white hover:text-primary-300 hover:border-primary-400/60 shadow-[0_4px_15px_rgba(0,0,0,0.2)]',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(baseClasses, variantClasses[variant], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }






