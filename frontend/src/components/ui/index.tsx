import React, { InputHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// BUTTON PRIMITIVE
// ==========================================
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95 duration-100",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20": variant === 'primary',
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border": variant === 'secondary',
            "hover:bg-accent hover:text-accent-foreground": variant === 'ghost',
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/10": variant === 'destructive',
            "glass text-foreground hover:bg-white/50 dark:hover:bg-slate-800/40": variant === 'glass',
          },
          {
            "h-8 px-3 text-xs": size === 'sm',
            "h-10 px-4 py-2 text-sm": size === 'md',
            "h-12 px-6 text-base": size === 'lg',
            "h-10 w-10 p-0": size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ==========================================
// INPUT PRIMITIVES
// ==========================================
export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

// ==========================================
// DIALOG / MODAL PRIMITIVE
// ==========================================
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children, title, size = 'md' }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog container */}
      <div className={cn(
        "glass relative z-10 w-full rounded-2xl p-6 shadow-2xl animate-fade-in focus:outline-none max-h-[90vh] overflow-y-auto",
        {
          "max-w-md": size === 'md',
          "max-w-2xl": size === 'lg',
          "max-w-4xl": size === 'xl',
        }
      )}>
        {title && (
          <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground font-sans">{title}</h2>
            <button 
              onClick={onClose} 
              className="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-lg transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

// ==========================================
// CARD PRIMITIVE
// ==========================================
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("glass-card overflow-hidden", className)} {...props} />
);

// ==========================================
// AVATAR PRIMITIVE
// ==========================================
interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, className, size = 'md' }) => {
  const safeName = name || '?';
  const initials = safeName
    .split(' ')
    .map((n) => n[0] || '')
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const colorHash = safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = colorHash % 360;
  const avatarBg = `hsl(${hue}, 70%, 45%)`;

  const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full items-center justify-center font-semibold text-white select-none border border-white/20",
        sizeClasses[size],
        className
      )}
      style={!src ? { backgroundColor: avatarBg } : undefined}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
