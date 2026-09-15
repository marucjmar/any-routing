import type { Map } from 'maplibre-gl';
import type { FeatureCollection, LineString, Position } from 'geojson';

export interface LineAnimationOptions {
  playing?: boolean;
  autoStart?: boolean;
  loop?: boolean;

  dashLength?: number;
  duration?: number;

  headColor?: string;
  tailColor?: string;
  backgroundColor?: string;

  headWidth?: number;
  tailWidth?: number;

  errorColor?: string;
  errorDashArray?: number[];
  errorMarkerSize?: number;

  geojson?: FeatureCollection<LineString>;
}

export class LineAnimation {
  private readonly id: string;

  private map?: Map;

  private geojson: FeatureCollection<LineString>;

  private playing: boolean;
  private readonly autoStart: boolean;
  private readonly loop: boolean;

  private readonly duration: number;
  private readonly dashLength: number;

  private readonly headWidth: number;
  private readonly tailWidth: number;

  private readonly headColor: string;
  private readonly tailColor: string;
  private readonly backgroundColor: string;

  private readonly errorColor: string;
  private readonly errorDashArray: number[];
  private readonly errorMarkerSize: number;

  private showingError = false;

  // ------------------------------------------------------------
  // SVG
  // ------------------------------------------------------------

  private svg?: SVGSVGElement;
  private svgPath?: SVGPathElement;

  /**
   * Animation Web Animations API.
   *
   * Nie używamy requestAnimationFrame do animowania linii.
   * Przeglądarka zajmuje się animacją SVG.
   */
  private animation?: Animation;

  // ------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------

  private readonly updateSvgPathHandler = (): void => {
    this.updateSvgPath();
  };

  constructor(id: string, options: LineAnimationOptions = {}) {
    const {
      playing = false,
      autoStart = true,
      loop = false,

      dashLength = 1,
      duration = 1000,

      headColor = 'rgba(0,0,0,1)',
      tailColor = 'rgba(0,0,0,1)',
      backgroundColor = 'rgba(0,0,0,0)',

      headWidth = 5,
      tailWidth = 5,

      errorColor = 'rgba(220,38,38,1)',
      errorDashArray = [0, 1.6],
      errorMarkerSize = 1.4,

      geojson = {
        type: 'FeatureCollection',
        features: [],
      },
    } = options;

    this.id = id;

    this.geojson = geojson;

    this.playing = playing;
    this.autoStart = autoStart;
    this.loop = loop;

    this.duration = duration;
    this.dashLength = dashLength;

    this.headWidth = headWidth;
    this.tailWidth = tailWidth;

    this.headColor = headColor;
    this.tailColor = tailColor;
    this.backgroundColor = backgroundColor;

    this.errorColor = errorColor;
    this.errorDashArray = errorDashArray;
    this.errorMarkerSize = errorMarkerSize;
  }

  // ============================================================
  // SVG
  // ============================================================

  private createSvg(): void {
    if (this.svgPath) {
      return;
    }

    const container = this.map?.getContainer();
    if (!container) return;

    let svg = container.querySelector<SVGSVGElement>('#svg-overlay');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'svg-overlay';
      svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      svg.style.inset = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '1000';
      container.appendChild(svg);
    }

    const path = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );

    path.id = `${this.id}-path`;

    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', this.headColor);
    path.setAttribute('stroke-width', String(this.headWidth));

    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    path.style.pointerEvents = 'none';

    svg.appendChild(path);

    this.svg = svg;
    this.svgPath = path;

    this.updateSvgPath();
  }

  /**
   * Zamienia wszystkie punkty LineString na SVG path.
   *
   * GeoJSON:
   *
   * [
   *   [lng, lat],
   *   [lng, lat],
   *   [lng, lat]
   * ]
   *
   * staje się:
   *
   * M x y L x y L x y
   */
  private updateSvgPath(): void {
    if (!this.map || !this.svgPath) {
      return;
    }

    const coordinates = this.geojson.features.flatMap((f) => f.geometry.coordinates);

    if (coordinates.length < 2) {
      this.svgPath.setAttribute('d', '');
      return;
    }

    if (coordinates.length < 2) {
      this.svgPath.setAttribute('d', '');
      return;
    }

    const path = coordinates
      .map((coordinate, index) => {
        const projected = this.map!.project([
          coordinate[0],
          coordinate[1],
        ]);

        return `${index === 0 ? 'M' : 'L'} ${projected.x} ${projected.y}`;
      })
      .join(' ');

    this.svgPath.setAttribute('d', path);

    /**
     * Po zmianie geometrii długość SVG path może się zmienić.
     *
     * Trzeba więc ponownie skonfigurować dash.
     */
    this.updateStroke();
  }

  /**
   * Ustawia długość ścieżki.
   */
  private updateStroke(): void {
    if (!this.svgPath) {
      return;
    }

    try {
      const length = this.svgPath.getTotalLength();

      if (!Number.isFinite(length) || length <= 0) {
        return;
      }

      this.svgPath.style.strokeDasharray = `${length}`;
    } catch {
      // SVG path może być chwilowo pusty podczas inicjalizacji.
    }
  }

  // ============================================================
  // Map
  // ============================================================

  addTo(map: Map): this {
    this.map = map;

    this.createSvg();

    this.updateSvgPath();

    /**
     * SVG musi być przeliczane tylko wtedy, gdy zmienia się
     * projekcja mapy.
     *
     * Nie robimy tego co klatkę animacji.
     */
    map.on('move', this.updateSvgPathHandler);
    map.on('resize', this.updateSvgPathHandler);

    /**
     * pitch / rotate są częścią transformacji mapy.
     *
     * `move` w MapLibre jest emitowane również podczas tych zmian,
     * ale zostawiamy dedykowane eventy dla bezpieczeństwa.
     */
    map.on('rotate', this.updateSvgPathHandler);
    map.on('pitch', this.updateSvgPathHandler);

    if (this.autoStart) {
      this.play();
    }

    return this;
  }

  // ============================================================
  // Animation
  // ============================================================

play(): this {
  if (this.playing) {
    return this;
  }

  if (!this.map || !this.svgPath) {
    return this;
  }

  if (this.showingError) {
    this.hideError();
  }

  const path = this.svgPath;

  if (!path.getAttribute('d')) {
    return this;
  }

  this.stopSvgAnimation();

  this.playing = true;

  // ----------------------------------------------------------
  // WAŻNE:
  // Normalizujemy długość SVG path do 1.
  // Dzięki temu nie zależy to od liczby punktów ani zoomu.
  // ----------------------------------------------------------

  path.setAttribute('pathLength', '1');

  path.setAttribute(
    'stroke-width',
    String(this.headWidth),
  );

  path.setAttribute(
    'stroke-linecap',
    'round',
  );

  path.setAttribute(
    'stroke-linejoin',
    'round',
  );

  this.applyGradient();

  // ----------------------------------------------------------
  // Długość animowanego fragmentu.
  //
  // dashLength:
  //   1   = cała trasa
  //   0.5 = połowa trasy
  //   0.1 = 10% trasy
  // ----------------------------------------------------------

  const dashLength = Math.max(
    0.001,
    Math.min(1, this.dashLength),
  );

  // ----------------------------------------------------------
  // UWAGA:
  //
  // Explicitnie podajemy:
  //
  //   DASH + GAP
  //
  // a nie tylko `${length}`.
  //
  // Dzięki temu SVG nie interpretuje wzoru w sposób,
  // który może powodować pozorny start od środka.
  // ----------------------------------------------------------

  path.style.strokeDasharray = `${dashLength} 1`;

  // Początek dokładnie na początku LineString.
  path.style.strokeDashoffset = '0';

  // ----------------------------------------------------------
  // Przesuwamy DASH od początku do końca.
  // ----------------------------------------------------------

  this.animation = path.animate(
    [
      {
        strokeDashoffset: '0',
      },
      {
        strokeDashoffset: '-1',
      },
    ],
    {
      duration: this.duration,
      iterations: this.loop ? Infinity : 1,
      easing: 'linear',
      fill: 'forwards',
    },
  );

  this.animation.onfinish = () => {
    if (!this.loop) {
      this.playing = false;
      this.animation = undefined;

      // Po zakończeniu możemy wyczyścić dash,
      // jeżeli chcesz zachować całą linię.
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
    }
  };

  return this;
}

  pause(): this {
    this.playing = false;

    if (this.animation) {
      this.animation.pause();
    }

    return this;
  }

  resume(): this {
    if (!this.animation) {
      return this.play();
    }

    this.playing = true;

    this.animation.play();

    return this;
  }

  private stopSvgAnimation(): void {
    if (this.animation) {
      this.animation.cancel();
      this.animation = undefined;
    }
  }

  private getPathLength(): number {
    if (!this.svgPath) {
      return 0;
    }

    try {
      const length = this.svgPath.getTotalLength();

      return Number.isFinite(length) && length > 0
        ? length
        : 0;
    } catch {
      return 0;
    }
  }

  // ============================================================
  // Gradient
  // ============================================================

  private applyGradient(): void {
    if (!this.svg || !this.svgPath) {
      return;
    }

    const gradientId = `${this.id}-gradient`;

    let defs = this.svg.querySelector('defs');

    if (!defs) {
      defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs',
      );

      this.svg.prepend(defs);
    }

    let gradient = this.svg.querySelector<SVGLinearGradientElement>(
      `#${gradientId}`,
    );

    if (!gradient) {
      gradient = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'linearGradient',
      );

      gradient.id = gradientId;

      defs.appendChild(gradient);
    }

    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');

    /**
     * Uwaga:
     *
     * SVG gradient jest związany z geometrią viewportu,
     * a nie z długością patha.
     *
     * Dlatego dla dokładnego gradientu head/tail lepiej
     * wykorzystać maskę/dash niż klasyczny gradient.
     *
     * Na ten moment ustawiamy prosty gradient koloru.
     */
    gradient.innerHTML = '';

    const tail = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );

    tail.setAttribute('offset', '0%');
    tail.setAttribute('stop-color', this.tailColor);

    const head = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );

    head.setAttribute('offset', '100%');
    head.setAttribute('stop-color', this.headColor);

    gradient.appendChild(tail);
    gradient.appendChild(head);

    this.svgPath.setAttribute(
      'stroke',
      `url(#${gradientId})`,
    );
  }

  // ============================================================
  // Progress
  // ============================================================

  /**
   * Zachowane dla kompatybilności z poprzednią implementacją.
   *
   * W SVG nie sterujemy progressem przez RAF.
   *
   * Możesz jednak ręcznie ustawić progress:
   *
   * 0   = początek
   * 1   = koniec
   */
  setProgress(progress: number): this {
    if (!this.svgPath) {
      return this;
    }

    const length = this.getPathLength();

    if (!length) {
      return this;
    }

    const normalized = Math.max(
      0,
      Math.min(1, progress),
    );

    this.svgPath.style.strokeDasharray = `${length}`;

    this.svgPath.style.strokeDashoffset = String(
      length * (1 - normalized),
    );

    return this;
  }

  // ============================================================
  // Error state
  // ============================================================

  showError(): this {
    this.pause();

    if (!this.svgPath) {
      return this;
    }

    this.showingError = true;

    this.stopSvgAnimation();

    const path = this.svgPath;

    const length = this.getPathLength();

    if (!length) {
      return this;
    }

    /**
     * Error line:
     *
     * pełna czerwona linia + przerywanie.
     */
    path.setAttribute(
      'stroke',
      this.errorColor,
    );

    path.setAttribute(
      'stroke-width',
      String(this.headWidth),
    );

    /**
     * Zamiast MapLibre symbol layer robimy SVG.
     *
     * errorDashArray np. [0, 1.6]
     * zostawiamy jako parametr kompatybilności,
     * ale SVG potrzebuje wartości w pikselach.
     */
    const dashSize = Math.max(
      1,
      this.errorMarkerSize * 4,
    );

    const gapSize = Math.max(
      1,
      this.errorMarkerSize * 3,
    );

    path.style.strokeDasharray = `${dashSize} ${gapSize}`;
    path.style.strokeDashoffset = '0';

    return this;
  }

  hideError(): this {
    if (!this.showingError) {
      return this;
    }

    this.showingError = false;

    if (!this.svgPath) {
      return this;
    }

    this.svgPath.style.strokeDasharray = '';
    this.svgPath.style.strokeDashoffset = '';

    this.svgPath.setAttribute(
      'stroke',
      this.headColor,
    );

    this.svgPath.setAttribute(
      'stroke-width',
      String(this.headWidth),
    );

    return this;
  }

  // ============================================================
  // Remove
  // ============================================================

  remove(): this {
    this.pause();

    this.stopSvgAnimation();

    if (this.map) {
      this.map.off(
        'move',
        this.updateSvgPathHandler,
      );

      this.map.off(
        'resize',
        this.updateSvgPathHandler,
      );

      this.map.off(
        'rotate',
        this.updateSvgPathHandler,
      );

      this.map.off(
        'pitch',
        this.updateSvgPathHandler,
      );
    }

    this.svgPath?.remove();

    this.svgPath = undefined;
    this.svg = undefined;

    this.map = undefined;

    this.showingError = false;

    return this;
  }

  // ============================================================
  // Update GeoJSON
  // ============================================================

  updateWaypoints(
    geojson: FeatureCollection<LineString>,
  ): this {
    this.geojson = geojson;

    /**
     * Jeśli istnieje animacja, zatrzymujemy ją,
     * ponieważ długość ścieżki mogła się zmienić.
     */
    const wasPlaying = this.playing;

    this.stopSvgAnimation();

    this.updateSvgPath();

    if (wasPlaying) {
      this.playing = false;
      this.play();
    }

    return this;
  }
}