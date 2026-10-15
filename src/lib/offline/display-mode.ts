/** Native installation state, independent of screen size and ordinary fullscreen. */
export function isInstalledComparator(): boolean {
  return matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}
