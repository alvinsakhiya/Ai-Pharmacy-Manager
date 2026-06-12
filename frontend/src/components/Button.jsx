import { buttonClassName } from "../utils/styles";

function Button({
  children,
  className = "",
  icon: Icon,
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, className)}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" size={18} strokeWidth={2} />}
      {children}
    </button>
  );
}

export default Button;
