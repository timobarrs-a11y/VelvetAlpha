import { createElement } from 'react';
import { AvatarV2 } from '../components/AvatarV2';
import { IAvatarRenderer, registerAvatarRenderer } from './AvatarRenderer';
import type { AvatarConfigV2 } from '../types/avatar-v2';

const svgRenderer: IAvatarRenderer = {
  id: 'svg-v2',
  render(config: AvatarConfigV2, className?: string) {
    return createElement(AvatarV2, { config, className });
  },
};

registerAvatarRenderer(svgRenderer);

export { svgRenderer as SVGAvatarRenderer };
