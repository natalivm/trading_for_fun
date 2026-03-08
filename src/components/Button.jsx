function Button({ children, onClick, variant = 'default', size = 'md', className = '', ...props }) {
  const base = 'font-semibold transition'

  const variants = {
    default: 'rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-400 hover:text-zinc-200',
    primary: 'rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30',
    danger: 'rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30',
  }

  const sizes = {
    sm: 'px-3 py-1 text-[10px]',
    md: 'px-4 py-2 text-xs',
    lg: 'w-full py-3 text-sm',
  }

  return (
    <button
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
