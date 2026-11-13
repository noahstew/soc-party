import Image from "next/image";

export function ZingerLogo() {
  return (
    <Image
      src="/zinger/logo.png"
      alt="Zinger"
      width={715}
      height={384}
      className="h-auto w-40 max-w-full object-contain"
    />
  );
}
