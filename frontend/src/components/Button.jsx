import { LoaderCircle } from "lucide-react";
import { buttonClassName } from "../utils/styles";

function Button({
  children,
  className = "",
  disabled = false,
  icon: Icon,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" size={18} strokeWidth={2} />
      ) : (
        Icon && <Icon aria-hidden="true" size={18} strokeWidth={2} />
      )}
      {children}
    </button>
  );
}

export default Button;
