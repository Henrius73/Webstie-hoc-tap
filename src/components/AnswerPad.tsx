// Bảng 4 đáp án cho học sinh (chọn / đã chọn / đã công bố).
import { Check, X } from 'lucide-react'
import { cx } from '../lib/utils'
import { LETTERS } from './ui'

const COLORS = [
  'bg-rose-600 border-rose-300/20 text-white',
  'bg-sky-600 border-sky-300/20 text-white',
  'bg-amber-500 border-amber-200/20 text-slate-950',
  'bg-emerald-600 border-emerald-300/20 text-white',
]

export function AnswerPad({
  options,
  myChoice,
  correctIndex,
  onPick,
  disabled = false,
}: {
  options: string[]
  myChoice: number | null
  correctIndex?: number | null
  onPick?: (index: number) => void
  disabled?: boolean
}) {
  const revealed = typeof correctIndex === 'number'

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option, index) => {
        const chosen = myChoice === index
        const isCorrect = correctIndex === index

        const state = revealed
          ? isCorrect
            ? 'ring-4 ring-emerald-300'
            : chosen
              ? 'opacity-70 ring-2 ring-rose-300/70'
              : 'opacity-40'
          : chosen
            ? 'scale-[1.02] ring-4 ring-white/80'
            : ''

        return (
          <button
            key={index}
            type="button"
            disabled={disabled || myChoice !== null || !onPick}
            onClick={() => onPick?.(index)}
            className={cx(
              'flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left text-lg font-semibold shadow-lg transition-all duration-200',
              COLORS[index % 4],
              'disabled:cursor-default',
              !myChoice && onPick && !disabled ? 'hover:brightness-110 active:scale-[0.99]' : '',
              state,
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/25 font-black">
              {LETTERS[index]}
            </span>
            <span className="flex-1 text-base leading-snug sm:text-lg">{option}</span>
            {revealed && isCorrect ? <Check className="h-6 w-6 shrink-0" /> : null}
            {revealed && chosen && !isCorrect ? <X className="h-6 w-6 shrink-0" /> : null}
          </button>
        )
      })}
    </div>
  )
}
