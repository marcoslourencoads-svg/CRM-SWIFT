"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"
import { AnimatePresence, motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#78716c", "#6b7280", "#64748b",
]

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  size?: "default" | "sm"
}

function ColorPicker({ value, onChange, className, size = "default" }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const isSmall = size === "sm"
  const safeColor = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6366f1"

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "shrink-0 border cursor-pointer",
            isSmall ? "h-5 w-5 rounded-full" : "h-8 w-8 rounded-md"
          )}
          style={{ backgroundColor: value || "#6366f1" }}
          animate={{ backgroundColor: safeColor }}
          transition={{ duration: 0.2 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366f1"
          className={cn(isSmall ? "h-7 w-28 text-sm" : "w-32")}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0.15 }}
            className="absolute top-full left-0 z-50 mt-1.5 rounded-lg border bg-popover p-3 shadow-md w-58 origin-top-left"
          >
            <HexColorPicker
              color={safeColor}
              onChange={onChange}
              style={{ width: "100%", height: "160px" }}
            />
            <div className="grid grid-cols-10 gap-1 mt-3">
              {PRESET_COLORS.map((c, i) => (
                <motion.button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false) }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02, type: "spring", stiffness: 400, damping: 15 }}
                  className={cn(
                    "h-5 w-5 rounded-full cursor-pointer",
                    value?.toLowerCase() === c && "ring-2 ring-ring ring-offset-1 ring-offset-background"
                  )}
                  style={{ backgroundColor: c }}
                  whileHover={{ scale: 1.35 }}
                  whileTap={{ scale: 0.8 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { ColorPicker }
