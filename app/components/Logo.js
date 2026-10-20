export default function Logo({
  className = "h-12 w-auto object-contain",
  alt = "DataCrumbs",
}) {
  return (
    <>
      <img
        src="/logo.png"
        alt={alt}
        className={`${className} dark-logo`}
      />
      <img
        src="/logo_light.png"
        alt={alt}
        className={`${className} light-logo`}
      />
    </>
  );
}
