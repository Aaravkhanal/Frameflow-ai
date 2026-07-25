interface FrameFlowLogoProps {
  className?: string;
  size?: number;
}

export function FrameFlowLogo({
  className = "",
  size = 40,
}: FrameFlowLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="FrameFlow AI Logo"
      width={size}
      height={size}
      className={`object-contain rounded-xl shadow-sm transition-all ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default FrameFlowLogo;
