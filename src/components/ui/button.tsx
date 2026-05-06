import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-30 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default:     'bg-zinc-100 text-zinc-950 hover:bg-white',
        secondary:   'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
        ghost:       'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200',
        destructive: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
        outline:     'border border-zinc-800 bg-transparent text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-7 px-3 text-xs',
        lg:      'h-10 px-5 text-sm',
        icon:    'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(button({ variant, size }), className)} {...props} />
}
