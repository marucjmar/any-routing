import { formatMS } from './utils';
import type { Popup } from 'maplibre-gl';
import type { AnyRoutingDataResponse, AnyRouting } from '@any-routing/core';

const icon =
  '<svg  width="20" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="car" class="svg-inline--fa fa-car fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path id="car" fill="#40abf7" d="M499.99 176h-59.87l-16.64-41.6C406.38 91.63 365.57 64 319.5 64h-127c-46.06 0-86.88 27.63-103.99 70.4L71.87 176H12.01C4.2 176-1.53 183.34.37 190.91l6 24C7.7 220.25 12.5 224 18.01 224h20.07C24.65 235.73 16 252.78 16 272v48c0 16.12 6.16 30.67 16 41.93V416c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32v-32h256v32c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32v-54.07c9.84-11.25 16-25.8 16-41.93v-48c0-19.22-8.65-36.27-22.07-48H494c5.51 0 10.31-3.75 11.64-9.09l6-24c1.89-7.57-3.84-14.91-11.65-14.91zm-352.06-17.83c7.29-18.22 24.94-30.17 44.57-30.17h127c19.63 0 37.28 11.95 44.57 30.17L384 208H128l19.93-49.83zM96 319.8c-19.2 0-32-12.76-32-31.9S76.8 256 96 256s48 28.71 48 47.85-28.8 15.95-48 15.95zm320 0c-19.2 0-48 3.19-48-15.95S396.8 256 416 256s32 12.76 32 31.9-12.8 31.9-32 31.9z"></path></svg>';

export interface AnnotationPopupComponentI {
  container: HTMLElement;
  destroy(): void;
}

export interface OnAttach {
  onAttach(popup: Popup): void;
}

export class AnnotationPopupComponent implements AnnotationPopupComponentI {
  public readonly container;

  private routeSelectedHandler = this.routeSelected.bind(this);

  constructor(private routeId, data, private ctx: AnyRouting) {
    this.container = document.createElement('div');

    this.container.onclick = () => {
      ctx.selectRoute(routeId);
    };

    ctx.on('routeSelected', this.routeSelectedHandler);

    this.render(routeId, data);
  }

  private render(routeId, data: AnyRoutingDataResponse) {
    this.container.style.padding = '4px 5px';
    this.container.style.display = 'flex';
    this.container.style.cursor = 'pointer';

    this.container.innerHTML = `
      ${icon}
      <div style="display: inline-block;  line-height: initial;">
        <div style="margin-left: 8px; font-size: .9rem">${formatMS(data.routes[routeId]?.durationTime * 1000)}</div>
        <span style="margin-left: 8px; font-size: .7rem;">${(data.routes[routeId]?.distance / 1000).toFixed(
          1
        )} km</span>
      </div>
    `;

    this.applyColor();
  }

  destroy() {
    this.ctx.off('routeSelected', this.routeSelectedHandler);
  }

  private routeSelected() {
    this.applyColor();
  }

  private applyColor() {
    const color = this.ctx.selectedRouteId === this.routeId ? '#e207ff' : '#33C9EB';

    this.container.querySelector('svg #car')?.setAttribute('fill', color);
  }
}
