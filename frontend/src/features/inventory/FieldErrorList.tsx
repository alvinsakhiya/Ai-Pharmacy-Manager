import { fieldErrorClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";

export function FieldErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className={cn(fieldErrorClass, "space-y-1")}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}
