export default function Logo({ className = "h-8 w-8 text-xs" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white ${className}`}
    >
      AB
    </span>
  );
}
