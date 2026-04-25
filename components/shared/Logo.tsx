export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">🐄</span>
      <span className={`font-black tracking-tight ${sizes[size]}`}>
        <span style={{ color: '#2D6A2F' }}>Gado</span>
        <span className="text-foreground">Control</span>
      </span>
    </div>
  );
}
