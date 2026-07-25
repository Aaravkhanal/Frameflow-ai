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
      className={`object-cover rounded-xl shadow-md border border-cyan-500/30 transition-all hover:border-cyan-400/60 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default FrameFlowLogo;
