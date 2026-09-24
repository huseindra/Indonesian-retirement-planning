"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets a `<form action>` after every submission, which wipes
 * what the user typed (and unchecks controlled radios) when the server
 * returns validation errors. This submit handler runs the same action
 * without the reset. Keep `action={formAction}` on the form as well so it
 * still works before JavaScript has loaded.
 */
export function usePreservingSubmit(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
