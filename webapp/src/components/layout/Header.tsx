interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 px-8 flex items-center">
      {title && (
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent drop-shadow-lg">{title}</h1>
      )}
    </header>
  );
}
