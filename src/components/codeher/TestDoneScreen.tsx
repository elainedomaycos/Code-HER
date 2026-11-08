import { useEffect, useRef } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { joinNames } from "./format";
import { btnPrimary, cardCls } from "./ui";

/** End of a test run: what would have gone out. Nothing was sent. */
export function TestDoneScreen() {
  const { testBody, contacts, backHome } = useCodeHer();
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    doneRef.current?.focus();
  }, []);
  const to = joinNames(contacts);
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-8">
      <div className="text-center" role="status">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <FlaskConical className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-balance text-3xl font-extrabold">Test complete</h1>
        <p className="mx-auto mt-2 max-w-xs text-lg text-muted-foreground">
          No message was sent. In a real alert, this is what your contacts get.
        </p>
      </div>

      {testBody && (
        <p
          aria-label="Message your contacts would get"
          className={cn(cardCls, "rounded-bl-md px-4 py-3 text-base leading-relaxed")}
        >
          {testBody}
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {to ? `It would go to ${to}.` : "Add a contact so a real alert reaches someone."}
      </p>

      <button ref={doneRef} type="button" onClick={backHome} className={cn(btnPrimary, "mt-auto")}>
        Back to home
      </button>
    </div>
  );
}
