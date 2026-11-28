type Props = { className?: string };

/** EARSHOT mark — a pair of fennec ears, drawn as paths so it holds at 16px. */
export default function Mark({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 48 42" className={className} role="img" aria-label="EARSHOT">
      <defs>
        <g id="es-ear">
          <path
            d="M4.5 40.5C1.6 27.2 3.4 12.4 13.4 2.2c4.6 6.6 7 19.6 6.2 38.3z"
            fill="currentColor"
          />
        </g>
      </defs>
      <use href="#es-ear" />
      <use href="#es-ear" transform="translate(23.2 0)" />
      <path
        d="M9.6 34.2c-1.4-9.4-.2-16.6 4.2-21.6 2.4 4.2 3.7 11.4 3.3 21.6z"
        fill="var(--color-ochre)"
        opacity="0.9"
      />
      <path
        d="M32.9 34.2c-.4-10.2.9-17.4 3.3-21.6 4.4 5 5.6 12.2 4.2 21.6z"
        fill="var(--color-ochre)"
        opacity="0.9"
      />
    </svg>
  );
}
