import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
  ScrollArea,
  Separator,
} from './UiComponents'
import { Loader2, X } from 'lucide-react'

// ─── Confirm Dialog ────────────────────────────────────────────────────────

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, variant = 'default', loading }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={() => onOpenChange && onOpenChange(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === 'destructive' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Form Modal ────────────────────────────────────────────────────────────

export function FormModal({ open, onOpenChange, title, description, icon, children, footer, maxWidth = 'max-w-lg' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxWidth} max-h-[90vh] border-0 shadow-2xl p-0 gap-0`}>
        <div className="px-6 pt-6 pb-4 relative">
          <button 
            onClick={() => onOpenChange && onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-50 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none bg-slate-100 hover:bg-slate-200 p-1.5"
          >
            <X className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900">{title}</DialogTitle>
                {description && <DialogDescription className="text-sm text-slate-500 mt-0.5">{description}</DialogDescription>}
              </div>
            </div>
          </DialogHeader>
        </div>
        <Separator />
        <ScrollArea className="max-h-[60vh]">
          <div className="p-6">
            {children}
          </div>
        </ScrollArea>
        {footer && (
          <>
            <Separator />
            <div className="px-6 py-4 flex justify-end gap-2 bg-slate-50/50 rounded-b-lg">
              {footer}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Detail Modal ──────────────────────────────────────────────────────────

export function DetailModal({ open, onOpenChange, title, subtitle, icon, children, maxWidth = 'max-w-2xl' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxWidth} max-h-[90vh] border-0 shadow-2xl p-0 gap-0`}>
        <div className="px-6 pt-6 pb-4 relative">
          <button 
            onClick={() => onOpenChange && onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-50 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none bg-slate-100 hover:bg-slate-200 p-1.5"
          >
            <X className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900">{title}</DialogTitle>
                {subtitle && <DialogDescription className="text-sm text-slate-500 mt-0.5">{subtitle}</DialogDescription>}
              </div>
            </div>
          </DialogHeader>
        </div>
        <Separator />
        <ScrollArea className="max-h-[70vh]">
          <div className="p-6">
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ─── Save Button ───────────────────────────────────────────────────────────

export function SaveButton({ loading, onSave, onCancel, saveLabel = 'Save' }) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <Button variant="outline" onClick={onCancel} disabled={loading} className="border-slate-200">Cancel</Button>
      <Button onClick={onSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saveLabel}
      </Button>
    </div>
  )
}
