interface ShaderBackgroundProps {
  isLightMode?: boolean;
}

const ShaderBackground = ({ isLightMode = false }: ShaderBackgroundProps) => {
  const background = isLightMode
    ? 'linear-gradient(135deg, #E8F7FF 0%, #87CEFA 48%, #0077B6 100%)'
    : 'linear-gradient(135deg, #000020 0%, #000080 48%, #0077B6 100%)';

  return (
    <div
      className="fixed top-0 left-0 w-full h-full -z-20 transition-colors duration-700"
      style={{ background }}
      aria-hidden="true"
    />
  );
};

export default ShaderBackground;
