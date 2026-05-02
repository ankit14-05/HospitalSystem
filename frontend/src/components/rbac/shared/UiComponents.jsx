import React, { useEffect, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════
// MINIMAL UI COMPONENTS — Plain Tailwind replacements for shadcn/ui
// These are simple, functional components — NOT full shadcn/ui ports.
// ═══════════════════════════════════════════════════════════════════════

// ─── Badge ────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', className = '', style, ...props }) {
  const variants = {
    default: 'bg-slate-900 text-white',
    secondary: 'bg-slate-100 text-slate-900',
    outline: 'border border-slate-200 text-slate-700 bg-transparent',
    destructive: 'bg-red-100 text-red-700 border border-red-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${variants[variant] || ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </span>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────
export function Button({ children, variant = 'default', size = 'default', className = '', disabled, ...props }) {
  const variants = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-700 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  }
  const sizes = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-11 px-6 text-base',
    icon: 'h-10 w-10',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant] || ''} ${sizes[size] || ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────
export function Input({ className = '', ...props }) {
  return (
    <input
      className={`flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}

// ─── Label ────────────────────────────────────────────────────────────────
export function Label({ className = '', children, ...props }) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
      {children}
    </label>
  )
}

// ─── Textarea ─────────────────────────────────────────────────────────────
export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-none ${className}`}
      {...props}
    />
  )
}

// ─── Select ───────────────────────────────────────────────────────────────
// A simple native select replacement for the shadcn/ui Select
export function Select({ value, onValueChange, children, ...props }) {
  // We need to extract SelectTrigger/SelectContent/SelectItem/SelectValue from children
  // But for simplicity, we render a native <select> element
  // The API mimics shadcn: value + onValueChange
  return (
    <select
      value={value || ''}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8"
      {...props}
    >
      {children}
    </select>
  )
}

// SelectTrigger, SelectContent, SelectItem, SelectValue are no-ops for API compat
// They are used as compound component patterns in the original code.
// We replace them with native <option> elements in the converted code.
// However, to maintain API compatibility with the original import pattern,
// we export these as simple wrappers.

export function SelectTrigger({ className = '', children, ...props }) {
  // This won't be used in the converted code, but exported for API compat
  return <div className={className} {...props}>{children}</div>
}

export function SelectContent({ children, ...props }) {
  return <>{children}</>
}

export function SelectItem({ value, children, disabled, ...props }) {
  return <option value={value} disabled={disabled} {...props}>{children}</option>
}

export function SelectValue({ placeholder }) {
  return null // placeholder text is handled by the native select
}

// ─── Checkbox ─────────────────────────────────────────────────────────────
export function Checkbox({ checked, onCheckedChange, className = '', ...props }) {
  return (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      className={`h-4 w-4 rounded border border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-600 ${className}`}
      {...props}
    />
  )
}

// ─── Switch (Toggle) ─────────────────────────────────────────────────────
export function Switch({ checked, onCheckedChange, className = '', ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${checked ? 'bg-emerald-600' : 'bg-slate-200'} ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────
export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  )
}

// ─── Dialog (Modal Overlay) ──────────────────────────────────────────────
export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={() => onOpenChange && onOpenChange(false)}
      />
      {/* Center content */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ className = '', children, ...props }) {
  return (
    <div
      className={`relative z-50 w-full max-w-lg rounded-xl bg-white shadow-2xl transition-all ${className}`}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )
}

export function DialogHeader({ className = '', children, ...props }) {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props}>
      {children}
    </div>
  )
}

export function DialogTitle({ className = '', children, ...props }) {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>
      {children}
    </h2>
  )
}

export function DialogDescription({ className = '', children, ...props }) {
  return (
    <p className={`text-sm text-slate-500 ${className}`} {...props}>
      {children}
    </p>
  )
}

export function DialogFooter({ className = '', children, ...props }) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`} {...props}>
      {children}
    </div>
  )
}

// ─── AlertDialog (Confirmation Dialog) ───────────────────────────────────
export function AlertDialog({ open, onOpenChange, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

export function AlertDialogContent({ className = '', children, ...props }) {
  return (
    <DialogContent className={`max-w-md ${className}`} {...props}>
      {children}
    </DialogContent>
  )
}

export function AlertDialogHeader({ className = '', children, ...props }) {
  return <div className={`p-6 ${className}`} {...props}>{children}</div>
}

export function AlertDialogTitle({ className = '', children, ...props }) {
  return <h2 className={`text-lg font-semibold ${className}`} {...props}>{children}</h2>
}

export function AlertDialogDescription({ className = '', children, ...props }) {
  return <p className={`text-sm text-slate-500 mt-2 ${className}`} {...props}>{children}</p>
}

export function AlertDialogFooter({ className = '', children, ...props }) {
  return <div className={`px-6 py-4 flex justify-end gap-2 bg-slate-50/50 rounded-b-xl ${className}`} {...props}>{children}</div>
}

export function AlertDialogAction({ className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function AlertDialogCancel({ className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────
export function Tabs({ value, onValueChange, className = '', children, ...props }) {
  return (
    <div className={className} data-value={value} {...props}>
      {typeof children === 'function' ? children({ value, onValueChange }) : children}
    </div>
  )
}

export function TabsList({ className = '', children, ...props }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, className = '', children, ...props }) {
  // Get parent Tabs context via DOM — simple approach
  const onClick = (e) => {
    // Walk up to find the Tabs container
    const tabsContainer = e.currentTarget.closest('[data-value]')
    if (tabsContainer) {
      const tabValue = tabsContainer.dataset.value
      // Dispatch a custom event
      const event = new CustomEvent('tab-change', { detail: value })
      tabsContainer.dispatchEvent(event)
    }
    if (props.onClick) props.onClick(e)
  }

  // We use a data attribute approach since we don't have React context here
  // The parent AccessControlPage.jsx will manage tab state directly
  return (
    <button
      data-tab-value={value}
      type="button"
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, className = '', children, ...props }) {
  // Simple: just render children — visibility is controlled by the parent
  return (
    <div data-tab-content={value} className={className} {...props}>
      {children}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────
export function Table({ className = '', children, ...props }) {
  return (
    <table className={`w-full caption-bottom text-sm ${className}`} {...props}>
      {children}
    </table>
  )
}

export function TableHeader({ className = '', children, ...props }) {
  return <thead className={className} {...props}>{children}</thead>
}

export function TableBody({ className = '', children, ...props }) {
  return <tbody className={className} {...props}>{children}</tbody>
}

export function TableRow({ className = '', children, ...props }) {
  return (
    <tr className={`border-b border-slate-100 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-50 ${className}`} {...props}>
      {children}
    </tr>
  )
}

export function TableHead({ className = '', children, ...props }) {
  return (
    <th className={`h-12 px-4 text-left align-middle font-semibold text-slate-600 text-xs uppercase tracking-wider ${className}`} {...props}>
      {children}
    </th>
  )
}

export function TableCell({ className = '', children, ...props }) {
  return (
    <td className={`p-4 align-middle ${className}`} {...props}>
      {children}
    </td>
  )
}

// ─── ScrollArea ──────────────────────────────────────────────────────────
export function ScrollArea({ className = '', children, ...props }) {
  return (
    <div className={`overflow-y-auto ${className}`} {...props}>
      {children}
    </div>
  )
}

// ─── Separator ───────────────────────────────────────────────────────────
export function Separator({ className = '', ...props }) {
  return (
    <hr className={`shrink-0 bg-slate-200 border-0 h-px my-2 ${className}`} {...props} />
  )
}
