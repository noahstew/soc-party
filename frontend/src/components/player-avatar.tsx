import Image from "next/image";

export function PlayerAvatar({
  avatarId,
  name,
}: {
  avatarId: number;
  name: string;
}) {
  return (
    <span className="block size-full overflow-hidden rounded-sm">
      <Image
        key={avatarId}
        src={`/zinger/players/${avatarId}.png`}
        alt={`${name} avatar`}
        width={88}
        height={88}
        className="player-avatar size-full object-contain"
      />
    </span>
  );
}
