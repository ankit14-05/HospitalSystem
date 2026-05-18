import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './UiComponents'
import { Input, Button } from './UiComponents'
import { ChevronLeft, ChevronRight, Search, ChevronsLeft, ChevronsRight, ArrowUpDown } from 'lucide-react'

// Column definition
// { key: string, header: string, render?: (item) => ReactNode, className?: string, sortable?: boolean }

export function DataTable({
  data,
  columns,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon,
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = search && searchKeys.length > 0
    ? data.filter(item =>
        searchKeys.some(key => {
          const val = item[key]
          return val && String(val).toLowerCase().includes(search.toLowerCase())
        })
      )
    : data

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(0, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible)
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible)
    }
    for (let i = start; i < end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="space-y-4">
      {searchKeys.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-10 h-10 bg-white border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20"
          />
        </div>
      )}
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <div className="max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200">
                {columns.map(col => (
                  <TableHead key={col.key} className={col.className}>
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && <ArrowUpDown className="h-3 w-3 text-slate-400" />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      {emptyIcon || <Search className="h-10 w-10 text-slate-300" />}
                      <p className="text-slate-500 font-medium">{emptyMessage}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item, idx) => (
                  <TableRow
                    key={idx}
                    className={`transition-colors duration-150 border-b border-slate-100 last:border-0 ${
                      onRowClick ? 'cursor-pointer hover:bg-emerald-50/50' : 'hover:bg-slate-50/50'
                    }`}
                    onClick={() => onRowClick && onRowClick(item)}
                  >
                    {columns.map(col => (
                      <TableCell key={col.key} className={`${col.className} py-3`}>
                        {col.render ? col.render(item) : String(item[col.key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{page * pageSize + 1}</span>–<span className="font-medium text-slate-700">{Math.min((page + 1) * pageSize, filtered.length)}</span> of <span className="font-medium text-slate-700">{filtered.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0} className="h-8 w-8 p-0">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getPageNumbers().map(p => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPage(p)}
                className={`h-8 w-8 p-0 ${p === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              >
                {p + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="h-8 w-8 p-0">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
