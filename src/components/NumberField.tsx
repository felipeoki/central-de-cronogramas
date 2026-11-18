import { useEffect, useState, type InputHTMLAttributes } from "react";
import { formatBRNumber, parseBRNumber } from "@/lib/schedule";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValueChange: (n: number) => void;
  decimals?: number;
};

/**
 * Text input for pt-BR numbers ("1.234,56"). The typed text is kept while focused and
 * committed on blur or Enter; invalid text reverts to the last value.
 */
export function NumberField({
  value,
  onValueChange,
  decimals = 2,
  onBlur,
  onKeyDown,
  ...rest
}: Props) {
  const [text, setText] = useState(() => formatBRNumber(value, decimals));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(formatBRNumber(value, decimals));
  }, [value, decimals, focused]);

  const commit = () => {
    const n = parseBRNumber(text);
    if (Number.isNaN(n) || n < 0) setText(formatBRNumber(value, decimals));
    else if (n !== value) onValueChange(n);
  };

  return (
    <input
      inputMode="decimal"
      {...rest}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => {
        commit();
        setFocused(false);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        onKeyDown?.(e);
      }}
    />
  );
}
