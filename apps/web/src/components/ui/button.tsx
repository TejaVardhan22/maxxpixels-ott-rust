import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-white shadow-sm hover:bg-primary-dark font-semibold',
        destructive: 'bg-red-600 text-white hover:bg-red-500',
        outline:
          'border border-white/15 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10',
        secondary: 'bg-white/10 text-white hover:bg-white/[0.14]',
        ghost: 'text-white hover:bg-white/10',
        link: 'text-gold underline-offset-4 hover:underline',
        accent: 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/25 font-semibold',
        glass: 'border border-white/10 bg-white/[0.06] text-white backdrop-blur-xl hover:bg-white/[0.1]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
