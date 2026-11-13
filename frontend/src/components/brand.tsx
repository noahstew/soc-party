import Image from "next/image";

export function Brand() {
  return (
    <Image
      src="/logo.png"
      alt="PartiSocial"
      width={1024}
      height={512}
      className="mx-auto h-auto w-64 max-w-full object-contain sm:w-80"
      priority
    />
  );
}
