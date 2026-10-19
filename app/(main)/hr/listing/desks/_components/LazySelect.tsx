"use client";

import { useState } from "react";

export type Choice = { value: string; label: string };
export type ChoiceGroup = { label: string; options: Choice[] };

/**
 * A native `<select>` that builds its option list the first time somebody goes
 * near it.
 *
 * **Why this exists.** Head office has 391 employees, 130 designations and 393
 * desks, and every row carries three pickers — one designation and two desks.
 * Rendering all of them eagerly is `391 × (130 + 393 + 393)` = **358,156
 * `<option>` elements**, about 33 MB of server-rendered HTML. The browser has
 * to parse it, React has to hydrate it, and **every keystroke in the search box
 * has to reconcile it** — which is exactly the two complaints the screen drew:
 * slow to load, slow to search.
 *
 * Closed, a select holds its placeholder and the one option it is currently
 * showing. That is 1,173 options for the whole table instead of 358,156, and
 * the list a reader actually opens is built in under a millisecond.
 *
 * **Filled on approach, not on click.** The row is what arms it (`filled`):
 * a pointer cannot reach a picker without crossing its row first, and focus
 * cannot land on one without entering the row either, so by the time anybody
 * presses a select the list is already built. The handlers below are the
 * backstop for a press that somehow skips both — a click under a cursor that
 * never moved, a touch. React flushes a discrete event's state before the
 * browser runs the event's default action, so filling in `onMouseDown` still
 * beats the popup opening; arming at the row is what makes that a backstop
 * rather than a bet.
 *
 * **It stays filled.** Once opened a row is usually worked on, and rebuilding
 * the list on every close would trade the fix for a stutter.
 */
export default function LazySelect({
  value,
  selectedLabel,
  placeholder,
  groups,
  exclude,
  disabled,
  className,
  armed,
  onChange,
}: {
  /** The current value, as a string — `""` means nothing is chosen. */
  value: string;
  /** What to show while the list is not built. */
  selectedLabel: string | null;
  /** The empty option's label — `— none —`, `— no desk —`. */
  placeholder: string;
  groups: ChoiceGroup[];
  /** One value to leave out: the primary desk, in the additional-charge picker. */
  exclude?: string;
  disabled?: boolean;
  className?: string;
  /** The row has been approached, so build the list. */
  armed?: boolean;
  onChange: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const fill = () => setTouched(true);
  const filled = armed || touched;

  return (
    <select
      value={value}
      disabled={disabled}
      className={className}
      onMouseEnter={fill}
      onMouseDown={fill}
      onTouchStart={fill}
      onFocus={fill}
      onKeyDown={fill}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {filled ? (
        groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) =>
              o.value === exclude ? null : (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ),
            )}
          </optgroup>
        ))
      ) : value === "" ? null : (
        // The controlled value must always have an option to match, or React
        // warns and the select renders blank.
        <option value={value}>{selectedLabel ?? value}</option>
      )}
    </select>
  );
}
