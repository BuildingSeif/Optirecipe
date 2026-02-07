interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 px-8 flex items-center">
      {title && (
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">{title}</h1>
      )}
    </header>
  );
}
