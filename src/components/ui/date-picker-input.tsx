"use client"

import * as React from "react"
import DatePicker from "tui-date-picker"
import "tui-date-picker/dist/tui-date-picker.css"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { parseDateKey, toDateKey } from "@/lib/date-range"

interface DatePickerInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

function DatePickerInput({ id, value, onChange, className }: DatePickerInputProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const openerRef = React.useRef<HTMLButtonElement>(null)
  const onChangeRef = React.useRef(onChange)

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    if (!containerRef.current || !inputRef.current) return

    const picker = new DatePicker(containerRef.current, {
      language: "ko",
      date: parseDateKey(value),
      input: { element: inputRef.current, format: "yyyy-MM-dd" },
      openers: openerRef.current ? [openerRef.current] : undefined,
    })
    picker.on("change", () => {
      onChangeRef.current(toDateKey(picker.getDate()))
    })

    return () => {
      picker.destroy()
    }
    // Only initialize once per mount — the parent remounts this component via `key`
    // when switching to a different record, so re-running this on every `value`
    // change isn't needed and would fight the picker's own internal state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="date-picker-popup-above relative">
      <input
        id={id}
        ref={inputRef}
        type="text"
        readOnly
        className={cn(
          "h-8 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
          className
        )}
      />
      <button
        ref={openerRef}
        type="button"
        tabIndex={-1}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
      >
        <CalendarIcon className="pointer-events-none size-4" />
      </button>
      <div ref={containerRef} />
    </div>
  )
}

export { DatePickerInput }
