// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import branding from '../../.brand/branding.json';

function assetUrl(path: string): string {
  if (!path) return '';
  if (!path.startsWith('assets/') || path.includes('\\') || path.split('/').includes('..')) {
    throw new Error('Brand artwork must stay inside brand/assets/.');
  }
  return `assets/brand/${path.slice('assets/'.length)}`;
}

export const BRAND = Object.freeze({
  ...branding,
  authorWebsiteLabel: branding.authorWebsite ? new URL(branding.authorWebsite).hostname : '',
  faviconUrl: assetUrl(branding.appFavicon),
  iconUrl: assetUrl(branding.appIcon),
  posterUrl: assetUrl(branding.appPoster),
});
