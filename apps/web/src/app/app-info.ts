// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import appMetadata from '../../.app-info/app-info.json';

function assetUrl(path: string): string {
  if (!path) return '';
  if (!path.startsWith('assets/') || path.includes('\\') || path.split('/').includes('..')) {
    throw new Error('Brand artwork must stay inside brand/assets/.');
  }
  return `assets/app/${path.slice('assets/'.length)}`;
}

export const APP_INFO = Object.freeze({
  ...appMetadata,
  authorWebsiteLabel: appMetadata.authorWebsite ? new URL(appMetadata.authorWebsite).hostname : '',
  faviconUrl: assetUrl(appMetadata.appFavicon),
  iconUrl: assetUrl(appMetadata.appIcon),
  posterUrl: assetUrl(appMetadata.appPoster),
});
