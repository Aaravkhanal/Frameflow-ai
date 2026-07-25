import React from "react";
import classNames from "classnames";

interface AgentBadgeProps {
  name: string;
  role: string;
  icon: string;
  color?: string;
  model?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const AgentBadge: React.FC<AgentBadgeProps> = ({
  name,
  role,
  icon,
  color = "#8B5CF6",
  model,
  className,
  size = "md",
}) => {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div
      className={classNames(
        "inline-flex items-center gap-2 rounded-full border shadow-sm transition-all duration-300",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color,
      }}
      title={`Role: ${role}${model ? ` | Model: ${model}` : ""}`}
    >
      <span className={iconSizes[size]}>{icon}</span>
      <span className="font-semibold tracking-wide flex items-center gap-1.5">
        {name}
        {model && (
          <span className="text-[10px] uppercase font-bold opacity-70 border px-1.5 py-0.5 rounded-full" style={{ borderColor: `${color}30` }}>
            {model.split("-")[0]}
          </span>
        )}
      </span>
    </div>
  );
};
