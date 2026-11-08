"use client";

import type { SelectHTMLAttributes } from "react";

// a <select> in a GET filter form that applies itself as soon as the choice changes (the form still works with the button)
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
