// 站点与 marketplace 地址统一从这里读取，不硬编码 IP/端口。
// 相关环境变量见 .env.example：
//   NEXT_PUBLIC_APP_URL          — 站点根地址（如 http://your-internal-host:7504）
//   NEXT_PUBLIC_MARKETPLACE_URL  — marketplace git 仓库地址（默认由 APP_URL 推导）
//   NEXT_PUBLIC_MARKETPLACE_NAME — marketplace 名称（默认 skill-hub）

// 站点根地址。未配置时返回空串，调用方按"未配置"处理（如隐藏绝对地址）。
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

export function getMarketplaceName(): string {
  return process.env.NEXT_PUBLIC_MARKETPLACE_NAME || 'skill-hub';
}

// marketplace git 仓库地址。
// 优先显式配置；否则由 APP_URL 推导（{APP_URL}/{name}.git），避免硬编码。
// 两者都未配置时返回空串。
export function getMarketplaceUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MARKETPLACE_URL;
  if (explicit) return explicit;
  const appUrl = getAppUrl();
  if (appUrl) return `${appUrl}/${getMarketplaceName()}.git`;
  return '';
}
