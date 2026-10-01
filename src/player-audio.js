// Run from a user action: recover inherited silence without changing a nonzero volume.
export function unmutePlayer(player) {
  player.unMute();
  if (player.getVolume() === 0) player.setVolume(50);
}
export function playerIsSilent(player) {
  return player.isMuted() || player.getVolume() === 0;
}
