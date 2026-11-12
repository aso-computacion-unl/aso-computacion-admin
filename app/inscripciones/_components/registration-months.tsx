"use client";

import { useState, type ReactNode } from "react";

import { eventsCountText, showingText } from "@/interface/event-registration/registration-months";

export interface RegistrationMonthGroup {
  key: string;
  heading: string;
  /** The month's stub, or null for the undated events (only "Todos" shows them). */
  name: string | null;
  /** The month in the status line, or null for the undated events. */
  ofMonth: string | null;
  count: number;
  /** The month's rows, rendered on the server. */
  rows: ReactNode;
}

const ALL = "all";

/**
 * The long list under a heading per month (S5), with the month filter above it when the events span two months or
 * more (S4): a ticket stub per month, the full month name over its count, and "Todos" first. The pressed stub shows
 * only its month; the status line says what is shown. Without JavaScript every month stays visible.
 */
export function RegistrationMonths({ total, groups }: { total: number; groups: RegistrationMonthGroup[] }) {
  const [shown, setShown] = useState(ALL);
  const months = groups.filter((group) => group.name !== null);
  const current = months.find((group) => group.key === shown);

  return (
    <>
      {months.length >= 2 ? (
        <>
          <nav className="reg-months" aria-label="Filtrar por mes">
            <MonthStub name="Todos" count={total} pressed={current === undefined} onPress={() => setShown(ALL)} />
            {months.map((group) => (
              <MonthStub key={group.key} name={group.name!} count={group.count} pressed={current?.key === group.key} onPress={() => setShown(group.key)} />
            ))}
          </nav>
          <p className="reg-showing" role="status">
            {current ? showingText(current.count, current.ofMonth) : showingText(total, null)}
          </p>
        </>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="reg-month" hidden={current !== undefined && current.key !== group.key}>
          <h2 className="reg-month-title">{group.heading}</h2>
          {group.rows}
        </section>
      ))}
    </>
  );
}

function MonthStub({ name, count, pressed, onPress }: { name: string; count: number; pressed: boolean; onPress: () => void }) {
  return (
    <button type="button" className="reg-stub" aria-pressed={pressed} onClick={onPress}>
      <span className="reg-stub-name">{name}</span>
      <small className="reg-stub-count">{eventsCountText(count)}</small>
    </button>
  );
}
