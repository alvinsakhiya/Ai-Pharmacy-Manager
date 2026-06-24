import { LayoutGrid } from "lucide-react";

import { EmptyState } from "../../components/ui/EmptyState";

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
      <EmptyState
        className="w-full animate-fade-in-up"
        icon={<LayoutGrid className="h-5 w-5" aria-hidden="true" />}
        title={title}
        description={description}
      />
    </div>
  );
}
