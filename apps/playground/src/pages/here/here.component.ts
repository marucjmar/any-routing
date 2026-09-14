import { Component, AfterViewInit, ElementRef, ViewChild, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Map } from 'maplibre-gl';
import { AnyRouting } from '@any-routing/core';
import { defaultMapLibreProjectorOptions, MapLibreProjector } from '@any-routing/maplibre-engine';
import { AnnotationPlugin } from '@any-routing/annotation-plugin';
import { LineLoaderPlugin } from '@any-routing/line-loader';
import { ValhallaRoutingData, ValhallaProvider } from '@any-routing/valhalla-data-provider';
import { OrsRoutingData, OrsProvider } from '@any-routing/ors-data-provider';
import { MapboxRoutingData, MapboxProvider } from '@any-routing/mapbox-data-provider';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ColorPicker } from 'primeng/colorpicker';
import { SelectButton } from 'primeng/selectbutton';
import { environment } from '../../environments/environment.prod';
import { HereProvider } from '../../../../../libs/here-data-provider/src/lib/here-data-provider';

@Component({
  selector: 'app-here-page',
  imports: [FormsModule, ToggleSwitch, ColorPicker, SelectButton],
  template: `
    <div class="controls">
      <div class="group">
        <span class="group-title">Plugins</span>

        <label class="control">
          <p-toggleswitch [(ngModel)]="annotationEnabled" (onChange)="onAnnotationToggle()" />
          <span>Annotation plugin</span>
        </label>

        <label class="control control--nested">
          <p-toggleswitch
            [(ngModel)]="calculatePopupOnFly"
            [disabled]="!annotationEnabled()"
            (onChange)="onCalculatePopupOnFlyToggle()"
          />
          <span>Annotation plugin: recalculate popups on fly</span>
        </label>

        <label class="control">
          <p-toggleswitch [(ngModel)]="lineLoaderEnabled" (onChange)="onLineLoaderToggle()" />
          <span>Line loader</span>
        </label>

        <label class="control control--nested control--row">
          <span>Line loader: animation color</span>
          <p-colorpicker [(ngModel)]="lineLoaderColor" (onChange)="onLineLoaderColorChange()" />
        </label>
      </div>

      <div class="group">
        <span class="group-title">Projector</span>

        <label class="control">
          <p-toggleswitch [(ngModel)]="hoverEnabled" (onChange)="onProjectorOptionsChange()" />
          <span>Route hover highlight</span>
        </label>

        <label class="control">
          <p-toggleswitch [(ngModel)]="canSelectRoute" (onChange)="onProjectorOptionsChange()" />
          <span>Route selection on click</span>
        </label>

        <label class="control">
          <p-toggleswitch [(ngModel)]="canAddWaypoints" (onChange)="onProjectorOptionsChange()" />
          <span>Add waypoints on route hover</span>
        </label>

        <label class="control">
          <p-toggleswitch [(ngModel)]="canDragWaypoints" (onChange)="onProjectorOptionsChange()" />
          <span>Drag waypoints</span>
        </label>

        <label class="control control--row">
          <span>Max waypoints</span>
          <input
            type="number"
            class="number-input"
            [(ngModel)]="maxWaypoints"
            min="2"
            max="50"
            (change)="onProjectorOptionsChange()"
          />
        </label>
      </div>

      <div class="group">
        <span class="group-title">Core</span>

        <label class="control control--column">
          <span>Waypoint sync strategy</span>
          <p-selectbutton
            [options]="waypointSyncStrategyOptions"
            optionLabel="label"
            optionValue="value"
            optionDisabled="disabled"
            [(ngModel)]="waypointsSyncStrategy"
            (onChange)="onWaypointsSyncStrategyChange()"
          />
        </label>
      </div>
    </div>

    <button
      type="button"
      class="code-toggle"
      [class.code-toggle--active]="codePanelOpen()"
      (click)="toggleCodePanel()"
      title="Show generated usage code"
    >
      &lt;/&gt;
    </button>

    @if (codePanelOpen()) {
      <div class="code-panel">
        <div class="code-panel-header">
          <span>Generated usage</span>
          <div class="code-panel-actions">
            <button type="button" (click)="copyCode()">{{ copied() ? 'Copied!' : 'Copy' }}</button>
            <button type="button" (click)="toggleCodePanel()">✕</button>
          </div>
        </div>
        <pre class="code-panel-body"><code>{{ generatedCode() }}</code></pre>
      </div>
    }

    <div id="map" #mapContainer>
     <svg id="svg-overlay">
        <line id="connection-line" />
    </svg>
    </div>
  `,
  styles: `
  #map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

#map {
    position: absolute;
    inset: 0;
}

#svg-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;

}

#connection-line {
    stroke: #ff0000;
    stroke-width: 3;
    fill: none;

    stroke-dasharray: 10 10;
    animation: moveLine 0.2s linear infinite;
}

#any-routing-line-loader-path {
stroke: #ff0000;
    stroke-width: 3;
    fill: none;

    stroke-dasharray: 10 10;
    animation: moveLine 0.2s linear infinite;
}

@keyframes moveLine {
    from {
        stroke-dashoffset: 0;
    }

    to {
        stroke-dashoffset: -20;
    }
}
    :host {
      display: block;
      position: relative;
    }

    .controls {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: row;
      gap: 16px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.92);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 220px;
    }

    .group-title {
      font-weight: 600;
      font-size: 0.85rem;
      color: #333;
      margin-bottom: 2px;
    }

    .control {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .control--nested {
      padding-left: 16px;
      opacity: 0.9;
    }

    .control--row {
      justify-content: space-between;
      cursor: default;
    }

    .control--column {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      cursor: default;
    }

    .number-input {
      width: 64px;
      padding: 4px 8px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 0.85rem;
    }

    .code-toggle {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: rgba(30, 30, 30, 0.9);
      color: #f5f5f5;
      font-family: 'Fira Code', 'JetBrains Mono', Consolas, monospace;
      font-size: 0.95rem;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      transition: background 0.15s ease;
      animation: code-toggle-pulse 2s ease-in-out infinite;
    }

    .code-toggle:hover {
      background: rgba(50, 50, 50, 0.95);
    }

    .code-toggle--active {
      background: #2f6feb;
      animation: none;
    }

    @keyframes code-toggle-pulse {
      0% {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(47, 111, 235, 0.6);
      }
      70% {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 10px rgba(47, 111, 235, 0);
      }
      100% {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(47, 111, 235, 0);
      }
    }

    .code-panel {
      position: absolute;
      top: 60px;
      right: 12px;
      z-index: 10;
      width: min(520px, 40vw);
      max-height: min(70vh, 640px);
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
      color: #d4d4d4;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .code-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #2a2a2a;
      font-size: 0.8rem;
      font-weight: 600;
      color: #e8e8e8;
    }

    .code-panel-actions {
      display: flex;
      gap: 6px;
    }

    .code-panel-actions button {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #e8e8e8;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .code-panel-actions button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .code-panel-body {
      margin: 0;
      padding: 12px 14px;
      overflow: auto;
      font-family: 'Fira Code', 'JetBrains Mono', Consolas, monospace;
      font-size: 0.78rem;
      line-height: 1.5;
      white-space: pre;
    }

    #map {
      display: block;
      width: 100%;
      height: 100vh;
    }
  `,
})
export class HereComponent implements AfterViewInit {
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  protected readonly annotationEnabled = signal(true);
  protected readonly lineLoaderEnabled = signal(true);
  protected readonly calculatePopupOnFly = signal(true);
  protected readonly lineLoaderColor = signal('c80000');

  protected readonly hoverEnabled = signal(true);
  protected readonly canSelectRoute = signal(true);
  protected readonly canAddWaypoints = signal(true);
  protected readonly canDragWaypoints = signal(true);
  protected readonly maxWaypoints = signal(25);

  protected readonly waypointsSyncStrategy = signal<'none' | 'toPath' | 'geocodeFirst'>('none');
  protected readonly waypointSyncStrategyOptions = [
    { label: 'None', value: 'none' as const },
    { label: 'To path', value: 'toPath' as const },
    { label: 'Geocode first', value: 'geocodeFirst' as const, disabled: true },
  ];

  protected readonly codePanelOpen = signal(false);
  protected readonly copied = signal(false);

  protected readonly generatedCode = computed(() => {
    const annotationEnabled = this.annotationEnabled();
    const lineLoaderEnabled = this.lineLoaderEnabled();
    const calculatePopupOnFly = this.calculatePopupOnFly();
    const lineLoaderColor = this.lineLoaderColor();
    const hoverEnabled = this.hoverEnabled();
    const canSelectRoute = this.canSelectRoute();
    const canAddWaypoints = this.canAddWaypoints();
    const canDragWaypoints = this.canDragWaypoints();
    const maxWaypoints = this.maxWaypoints();
    const waypointsSyncStrategy = this.waypointsSyncStrategy();

    const imports = [
      "import { Map } from 'maplibre-gl';",
      "import { OrsProvider } from '@any-routing/ors-data-provider';",
      "import { AnyRouting } from '@any-routing/core';",
      "import { MapLibreProjector, defaultMapLibreProjectorOptions } from '@any-routing/maplibre-engine';",
    ];

    if (annotationEnabled) {
      imports.push("import { AnnotationPlugin } from '@any-routing/annotation-plugin';");
    }
    if (lineLoaderEnabled) {
      imports.push("import { LineLoaderPlugin } from '@any-routing/line-loader';");
    }

    const projectorOptionLines = [
      '  ...defaultMapLibreProjectorOptions,',
      '  map,',
      `  hoverEnabled: ${hoverEnabled},`,
      `  canSelectRoute: ${canSelectRoute},`,
      `  canAddWaypoints: ${canAddWaypoints},`,
      `  canDragWaypoints: ${canDragWaypoints},`,
      `  maxWaypoints: ${maxWaypoints},`,
    ];

    const pluginLines: string[] = [];
    const pluginSetupLines: string[] = [];

    if (lineLoaderEnabled) {
      pluginSetupLines.push(
        'const lineLoaderPlugin = new LineLoaderPlugin({',
        '  map,',
          '  projector,',
        '  animation: {',
        `    headColor: '${this.hexToRgba(lineLoaderColor, 1)}',`,
        `    tailColor: '${this.hexToRgba(lineLoaderColor, 0)}',`,
        '  },',
        '});',
      );
      pluginLines.push('lineLoaderPlugin');
    }

    if (annotationEnabled) {
      pluginSetupLines.push(
        'const annotationPlugin = new AnnotationPlugin({',
        '  projector,',
        '  map,',
        `  calculatePopupOnFly: ${calculatePopupOnFly},`,
        '});',
      );
      pluginLines.push('annotationPlugin');
    }

    const lines = [
      ...imports,
      '',
      "const map = new Map({",
      "  container: mapContainer,",
      "  center: [13, 51],",
      '  zoom: 4,',
      "  style: 'https://tiles.openfreemap.org/styles/liberty',",
      '});',
      '',
      'const projector = new MapLibreProjector({',
      ...projectorOptionLines,
      '});',
      '',
      'const dataProvider = new OsrmProvider({',
      '   alternatives: 2,',
      '});',
      ...pluginSetupLines,
      pluginSetupLines.length ? '' : undefined,
      'const routing = new AnyRouting({',
      '  dataProvider,',
      `  projector,`,
      `  plugins: [${pluginLines.join(', ')}],`,
      `  waypointsSyncStrategy: '${waypointsSyncStrategy}',`,
      '});',
      '',
      "// Listen for freshly calculated routes",
      "routing.on('routesFound', (event) => {",
      '  console.log(event);',
      '});',
      '',
      "map.on('load', () => {",
      '  routing.initialize();',
      '  routing.setWaypoints([',
      "    { position: { lng: -3.385644, lat: 40.484768 }, properties: { label: 'A' } },",
      "    { position: { lng: 23.064007, lat: 52.749891 }, properties: { label: 'B' } },",
      '  ]);',
      '  routing.recalculateRoute(),then(() => projector.fitViewToData());',
      '});',
    ].filter((line): line is string => line !== undefined);

    return lines.join('\n');
  });

  private routing?: AnyRouting<MapboxRoutingData>;
  private map?: Map;
  private projector?: MapLibreProjector;
  private annotationPlugin?: AnnotationPlugin;
  private lineLoaderPlugin?: LineLoaderPlugin;

  ngAfterViewInit() {
    const map = new Map({
      container: this.mapContainer!.nativeElement,
      center: [13, 51],
      zoom: 4,
      style: 'https://tiles.openfreemap.org/styles/liberty',
    });
    this.map = map;

    const dataProvider = new HereProvider({
      apiKey: environment.hereApiKey,
      alternatives: 2,
      // shapePolylinePrecision: 0.0001,
    });

    const previewDataProvider = new HereProvider({
      apiKey: environment.hereApiKey,
      alternatives: 0,
      // shapePolylinePrecision: 0.0001,
    });

    const projector = new MapLibreProjector({
      ...defaultMapLibreProjectorOptions,
      map,
      hoverEnabled: this.hoverEnabled(),
      canSelectRoute: this.canSelectRoute(),
      canAddWaypoints: this.canAddWaypoints(),
      canDragWaypoints: this.canDragWaypoints(),
      maxWaypoints: this.maxWaypoints(),
      routesWhileDragging: true,
      previewDataProvider: previewDataProvider,
    });
    this.projector = projector;

    const routing = new AnyRouting<MapboxRoutingData, MapLibreProjector>({
      dataProvider,
      projector,
      waypointsSyncStrategy: this.waypointsSyncStrategy(),
      // geocoder: async (waypoint) => {
      //  const geocode = await fetch(`https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=${environment.hereApiKey}&in=circle:${waypoint.position.lat},${waypoint.position.lng};r=50&limit=1&lang=pl&types=address,houseNumber,city,postalCode,area,street&includeUnnamedStreet=true`);
      //   const data = await geocode.json();

      //  console.log(data)
      //   return { ...waypoint, mappedPosition: data.items[0].position, position: data.items[0].position };
      // }
    });
    this.routing = routing;

    map.on('load', async () => {
      routing.initialize();

      if (this.annotationEnabled()) {
        this.annotationPlugin = routing.addPlugin(
          new AnnotationPlugin({ map, calculatePopupOnFly: this.calculatePopupOnFly() }),
        ) as AnnotationPlugin;
      }

      if (this.lineLoaderEnabled()) {
        this.lineLoaderPlugin = routing.addPlugin(this.createLineLoaderPlugin(map));
      }

      routing.on('routesFound', (event) => {
        console.log(event);
      });

      routing.setWaypoints([
        { position: { lng: -3.385644, lat: 40.484768 }, properties: { label: 'B' } },
        { position: { lng: 23.064007, lat: 52.749891 }, properties: { label: 'C' } },
      ]);

      routing.recalculateRoute().then(() => {
        projector.fitViewToData({ padding: 40 });
      });
    });
  }

  protected onAnnotationToggle(): void {
    if (!this.routing || !this.map) {
      return;
    }

    if (this.annotationEnabled()) {
      this.annotationPlugin = this.routing.addPlugin(
        new AnnotationPlugin({ map: this.map, calculatePopupOnFly: this.calculatePopupOnFly() }),
      ) as AnnotationPlugin;
    } else if (this.annotationPlugin) {
      this.routing.removePlugin(this.annotationPlugin);
      this.annotationPlugin = undefined;
    }
  }

  protected onLineLoaderToggle(): void {
    if (!this.routing || !this.map) {
      return;
    }

    if (this.lineLoaderEnabled()) {
      this.lineLoaderPlugin = this.routing.addPlugin(this.createLineLoaderPlugin(this.map));
    } else if (this.lineLoaderPlugin) {
      this.routing.removePlugin(this.lineLoaderPlugin);
      this.lineLoaderPlugin = undefined;
    }
  }

  protected onLineLoaderColorChange(): void {
    if (!this.routing || !this.map || !this.lineLoaderEnabled()) {
      return;
    }

    if (this.lineLoaderPlugin) {
      this.routing.removePlugin(this.lineLoaderPlugin);
    }

    this.lineLoaderPlugin = this.routing.addPlugin(this.createLineLoaderPlugin(this.map));
  }

  private createLineLoaderPlugin(map: Map): LineLoaderPlugin {
    const color = this.lineLoaderColor();
    return new LineLoaderPlugin({
      map,
      projector: this.projector!,
      animation: {
        headColor: this.hexToRgba(color, 1),
        tailColor: this.hexToRgba(color, 0),
      },
    });
  }

  private hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.substring(0, 2), 16) || 0;
    const g = parseInt(normalized.substring(2, 4), 16) || 0;
    const b = parseInt(normalized.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  protected onCalculatePopupOnFlyToggle(): void {
    this.annotationPlugin?.setCalculatePopupOnFly(this.calculatePopupOnFly());
  }

  protected onProjectorOptionsChange(): void {
    if (!this.projector) {
      return;
    }

    this.projector.setHoverEnabled(this.hoverEnabled());
    this.projector.setCanSelectRoute(this.canSelectRoute());
    this.projector.setCanAddWaypoints(this.canAddWaypoints());
    this.projector.setCanDragWaypoint(this.canDragWaypoints());
    this.projector.setMaxWaypoints(this.maxWaypoints());
  }

  protected onWaypointsSyncStrategyChange(): void {
    this.routing?.setWaypointsSyncStrategy(this.waypointsSyncStrategy());
  }

  protected toggleCodePanel(): void {
    this.codePanelOpen.update((open) => !open);
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedCode());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable or denied; silently ignore.
    }
  }
}
