// The inline loading screen in index.html (docs/03 §11): once there is
// something to show, its ink dissolves into the night sky and it is removed.
export function dismissBoot(): void {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('done')) return;
  boot.classList.add('done');
  window.setTimeout(() => boot.remove(), 1000);
}
