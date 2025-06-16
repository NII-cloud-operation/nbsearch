import { LabIcon } from '@jupyterlab/ui-components';

import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

type Icon = {
  icon: any[];
};

function extractSvgString(icon: Icon): string {
  const path = icon.icon[4];
  return `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16">
  <g class="jp-icon3" fill="#616161">
    <path transform="scale(0.035, 0.035) translate(0, 0)" d="${path}" />
  </g>
</svg>`;
}

export const nbsearchIcon = extractSvgString(faMagnifyingGlass);

export const searchIcon = new LabIcon({
  name: 'nbsearch::notebooksearch',
  svgstr: nbsearchIcon
});
